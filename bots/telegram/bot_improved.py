import logging
import os
import asyncio
import aiohttp
from datetime import datetime
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from anthropic import Anthropic
from logging.handlers import RotatingFileHandler

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

file_handler = RotatingFileHandler('bot.log', maxBytes=10000000, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000/api')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
ADMIN_PANEL_URL = os.getenv('ADMIN_PANEL_URL', 'http://localhost:3001')
CLIENT_ID = os.getenv('CLIENT_ID', '')
BOT_API_SECRET = os.getenv('BOT_API_SECRET', '')

# Runtime config loaded from admin panel on startup — values here are defaults
_client_config: dict = {}
_features: dict = {}

# Anthropic client — may be replaced after config load if client has their own key
client: Anthropic | None = None

conversations = {}
user_data = {}
user_last_message_time = {}

DEFAULT_IMAGE_KEYWORDS = [
    'genera una imagen', 'crea una imagen', 'diseña una imagen',
    'hazme una imagen', 'genera foto', 'crea foto', 'ilustración de',
]


async def load_client_config() -> None:
    """Fetch configuration from the admin panel and update module-level state."""
    global client, _client_config, _features

    if not CLIENT_ID or not BOT_API_SECRET:
        logger.warning('CLIENT_ID or BOT_API_SECRET not set — using env-var defaults only')
        _init_anthropic(os.getenv('ANTHROPIC_API_KEY', ''))
        return

    url = f'{ADMIN_PANEL_URL}/api/bot-config/{CLIENT_ID}'
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(
                url,
                headers={'Authorization': f'Bearer {BOT_API_SECRET}'},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status != 200:
                    text = await resp.text()
                    logger.error(f'Failed to load config ({resp.status}): {text}')
                    _init_anthropic(os.getenv('ANTHROPIC_API_KEY', ''))
                    return

                data = await resp.json()
                _features = data.get('features', {})
                _client_config = data.get('config', {})
                logger.info(f'Config loaded for client "{data.get("clientName")}" — features: {_features}')

    except Exception as e:
        logger.error(f'Error loading config from admin panel: {e}')
        _init_anthropic(os.getenv('ANTHROPIC_API_KEY', ''))
        return

    # Resolve Anthropic API key: prefer per-client key from DB, fall back to env var
    ia_cfg = _client_config.get('chatbot_ia', {})
    anthropic_key = ia_cfg.get('anthropic_api_key', '') or os.getenv('ANTHROPIC_API_KEY', '')
    _init_anthropic(anthropic_key)


def _init_anthropic(api_key: str) -> None:
    global client
    if api_key:
        try:
            client = Anthropic(api_key=api_key)
            logger.info('Anthropic client initialized successfully')
        except Exception as e:
            logger.error(f'Failed to initialize Anthropic client: {e}')
            client = None
    else:
        logger.warning('No Anthropic API key available — AI chatbot will be disabled')
        client = None


def _get_system_prompt() -> str:
    """Return the system prompt to use for Claude, based on admin panel config."""
    ia_cfg = _client_config.get('chatbot_ia', {})

    # Use custom system prompt from admin panel if configured
    if ia_cfg.get('system_prompt'):
        prompt = ia_cfg['system_prompt']
        description = ia_cfg.get('business_description', '')
        if description:
            prompt = f"Información del negocio:\n{description}\n\n{prompt}"
        return prompt

    # Fall back to generic sales assistant prompt
    return (
        "Eres un asistente de ventas experto ayudando a calificar leads y gestionar oportunidades de venta. "
        "Eres amable, profesional y enfocado en entender las necesidades del cliente. "
        "Cuando identifiques un potencial lead:\n"
        "1. Recopila información: nombre, empresa, necesidad principal\n"
        "2. Califica el lead (alto/medio/bajo)\n"
        "3. Sugiere próximos pasos\n"
        "Responde siempre en español."
    )


def _get_welcome_message(user_name: str) -> str:
    """Return the /start welcome message, using admin panel config if available."""
    tg_cfg = _client_config.get('telegram', {})
    bot_description = tg_cfg.get('bot_description', '')

    basic_cfg = _client_config.get('chatbot_basico', {})
    welcome_msg = basic_cfg.get('welcome_message', '')

    if welcome_msg:
        return f"¡Hola {user_name}! 👋\n\n{welcome_msg}"

    if bot_description:
        return (
            f"¡Hola {user_name}! 👋\n\n"
            f"{bot_description}\n\n"
            "Escribe /reset para limpiar nuestra conversación\n"
            "Escribe /imagen <descripción> para generar una imagen con IA"
        )

    return (
        f"¡Hola {user_name}! 👋\n\n"
        "Bienvenido a nuestro Bot de Ventas con IA.\n\n"
        "¿Qué deseas hacer?\n"
        "• Consultarme sobre productos\n"
        "• Registrar un nuevo lead\n"
        "• Obtener información de ventas\n\n"
        "Escribe /reset para limpiar nuestra conversación\n"
        "Escribe /imagen <descripción> para generar una imagen con IA"
    )


def _get_image_keywords() -> list[str]:
    """Return image trigger keywords from config or defaults."""
    img_cfg = _client_config.get('generacion_imagenes', {})
    raw = img_cfg.get('trigger_keywords', '')
    if raw:
        return [kw.strip().lower() for kw in raw.split(',') if kw.strip()]
    return DEFAULT_IMAGE_KEYWORDS


def _is_ia_enabled() -> bool:
    return _features.get('chatbot_ia', True) and client is not None


def cleanup_old_conversations():
    for uid in list(conversations.keys()):
        if len(conversations[uid]) > 50:
            conversations[uid] = conversations[uid][-50:]


def _is_rate_limited(user_id: int) -> bool:
    now = datetime.now()
    last = user_last_message_time.get(user_id)
    if last and (now - last).total_seconds() < 2:
        return True
    user_last_message_time[user_id] = now
    return False


class SalesBotManager:
    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.session = None

    async def init_session(self):
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def close_session(self):
        if self.session:
            await self.session.close()

    def _bot_headers(self) -> dict:
        headers = {}
        if BOT_API_SECRET:
            headers['Authorization'] = f'Bearer {BOT_API_SECRET}'
        return headers

    async def create_lead(self, data: dict):
        await self.init_session()
        try:
            async with self.session.post(
                f'{self.api_base_url}/leads',
                json={
                    'source': 'telegram',
                    'first_name': data.get('first_name'),
                    'title': data.get('title'),
                    'phone': data.get('phone'),
                    'email': data.get('email'),
                    'description': data.get('description'),
                    'value': data.get('value'),
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY")}'},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                if response.status == 201:
                    return await response.json()
                return None
        except Exception as e:
            logger.error(f'Error creating lead: {e}')
            return None

    async def log_interaction(self, user_id: int, message: str, response: str):
        await self.init_session()
        try:
            async with self.session.post(
                f'{self.api_base_url}/chat-logs',
                json={
                    'channel': 'telegram',
                    'sender_id': str(user_id),
                    'message': message,
                    'response': response,
                    'timestamp': datetime.now().isoformat(),
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY")}'},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return resp.status == 201
        except Exception as e:
            logger.error(f'Error logging interaction: {e}')
            return False

    async def generate_image(self, prompt: str) -> dict:
        if not CLIENT_ID:
            return {'error': 'CLIENT_ID no configurado en las variables de entorno del bot.'}
        await self.init_session()
        img_cfg = _client_config.get('generacion_imagenes', {})
        intro = img_cfg.get('intro_message', '')
        try:
            async with self.session.post(
                f'{ADMIN_PANEL_URL}/api/image-gen',
                json={'clientId': CLIENT_ID, 'prompt': prompt, 'channel': 'telegram'},
                headers=self._bot_headers(),
                timeout=aiohttp.ClientTimeout(total=60),
            ) as resp:
                data = await resp.json()
                if resp.status == 200:
                    return {**data, 'intro_message': intro}
                return {'error': data.get('error', 'Error desconocido al generar imagen.'),
                        'limitReached': data.get('limitReached', False)}
        except asyncio.TimeoutError:
            return {'error': 'La generación tardó demasiado. Intenta de nuevo.'}
        except Exception as e:
            logger.error(f'Image generation error: {e}')
            return {'error': 'No se pudo conectar al servicio de imágenes.'}


bot_manager = SalesBotManager(API_BASE_URL)


async def _send_image_result(update: Update, result: dict, prompt: str) -> None:
    if 'imageUrl' in result:
        caption = f"✨ *Imagen generada*\n📝 _{prompt[:200]}_"
        try:
            await update.message.reply_photo(
                photo=result['imageUrl'],
                caption=caption,
                parse_mode='Markdown',
            )
            remaining = result.get('dailyLimit', 0) - result.get('usageToday', 0)
            if result.get('dailyLimit', 0) > 0:
                await update.message.reply_text(
                    f"📊 Imágenes restantes hoy: *{remaining}*",
                    parse_mode='Markdown',
                )
        except Exception as e:
            logger.error(f'Error sending photo: {e}')
            await update.message.reply_text(
                f"✅ Imagen generada:\n{result['imageUrl']}\n\n"
                "(Copia y pega el link en tu navegador)"
            )
    else:
        img_cfg = _client_config.get('generacion_imagenes', {})
        error_msg = result.get('error', img_cfg.get('error_message', 'No se pudo generar la imagen.'))
        limit_msg = img_cfg.get('limit_reached_message', error_msg)
        if result.get('limitReached'):
            await update.message.reply_text(f"⏰ {limit_msg}")
        else:
            await update.message.reply_text(f"❌ {error_msg}")


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_name = update.effective_user.first_name
    user_id = update.effective_user.id

    if user_id not in user_data:
        user_data[user_id] = {
            'first_name': user_name,
            'telegram_id': user_id,
            'stage': 'greeting',
        }

    keyboard = [
        [InlineKeyboardButton("📋 Calificar Lead", callback_data='qualify_lead')],
        [InlineKeyboardButton("📊 Ver Estado", callback_data='check_status')],
        [InlineKeyboardButton("ℹ️ Ayuda", callback_data='help')],
    ]
    await update.message.reply_text(
        _get_welcome_message(user_name),
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def handle_message(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    user_message = update.message.text

    if not user_message or not user_message.strip():
        await update.message.reply_text("Por favor escribe un mensaje válido.")
        return

    if _is_rate_limited(user_id):
        await update.message.reply_text("⏱️ Por favor espera un momento antes de enviar otro mensaje.")
        return

    if user_id not in conversations:
        conversations[user_id] = []
    if user_id not in user_data:
        user_data[user_id] = {'telegram_id': user_id}

    # Detect image generation request in natural language
    msg_lower = user_message.lower()
    if _features.get('generacion_imagenes', False) and any(kw in msg_lower for kw in _get_image_keywords()):
        conversations[user_id].append({"role": "user", "content": user_message})
        await update.message.chat.send_action("upload_photo")
        img_cfg = _client_config.get('generacion_imagenes', {})
        intro = img_cfg.get('intro_message', '🎨 Detecté que quieres una imagen. Generando con IA...')
        await update.message.reply_text(intro)
        result = await bot_manager.generate_image(user_message)
        await _send_image_result(update, result, user_message)
        if 'imageUrl' in result:
            conversations[user_id].append({
                "role": "assistant",
                "content": f"[Imagen generada para: {user_message[:100]}]",
            })
        return

    # Basic chatbot (no AI) — used when chatbot_ia is off but chatbot_basico is on
    if not _is_ia_enabled():
        basic_cfg = _client_config.get('chatbot_basico', {})
        fallback = basic_cfg.get('fallback_message', 'Para más información contáctanos directamente.')
        await update.message.reply_text(fallback)
        return

    await update.message.chat.send_action("typing")
    conversations[user_id].append({"role": "user", "content": user_message})

    try:
        logger.info(f'User {user_id}: {user_message}')

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=_get_system_prompt(),
            messages=conversations[user_id],
        )

        assistant_message = response.content[0].text
        conversations[user_id].append({"role": "assistant", "content": assistant_message})

        if len(conversations[user_id]) > 20:
            conversations[user_id] = conversations[user_id][-20:]

        logger.info(f'Response sent to user {user_id}')
        await bot_manager.log_interaction(user_id, user_message, assistant_message)
        await update.message.reply_text(assistant_message)

        if any(word in user_message.lower() for word in ['interesado', 'necesito', 'quiero', 'cotización']):
            await suggest_lead_creation(update)

    except Exception as e:
        logger.error(f'Error processing message from {user_id}: {e}')
        await update.message.reply_text(
            "❌ Error al procesar tu mensaje.\n"
            "Por favor intenta de nuevo."
        )


async def suggest_lead_creation(update: Update):
    keyboard = [
        [InlineKeyboardButton("📋 Registrar Lead", callback_data='create_lead')],
        [InlineKeyboardButton("❌ No, gracias", callback_data='skip_lead')],
    ]
    await update.message.reply_text(
        "¿Deseas registrar esto como un nuevo lead en nuestro sistema?",
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


async def handle_callback(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()

    if query.data == 'qualify_lead':
        await query.edit_message_text(
            "Perfecto! Voy a recopilar información para calificar el lead.\n"
            "¿Cuál es el nombre de la persona/empresa?"
        )
    elif query.data == 'create_lead':
        lead = await bot_manager.create_lead(user_data.get(user_id, {}))
        if lead:
            await query.edit_message_text(
                f"✅ Lead registrado exitosamente!\n"
                f"ID: {lead.get('id')}\n"
                f"Se notificará al equipo de ventas."
            )
        else:
            await query.edit_message_text("❌ Error al registrar el lead. Intenta de nuevo.")
    elif query.data == 'check_status':
        await query.edit_message_text(
            "📊 Estado de tus leads:\n"
            "• Leads activos: 3\n"
            "• Seguimiento pendiente: 2\n"
            "• Cerrados: 1"
        )
    elif query.data == 'help':
        await query.edit_message_text(
            "📚 Guía de uso:\n"
            "/start - Iniciar\n"
            "/reset - Limpiar conversación\n"
            "/imagen <descripción> - Generar imagen con IA\n\n"
            "Escribe cualquier pregunta sobre productos, precios, etc."
        )
    elif query.data == 'skip_lead':
        await query.edit_message_text("De acuerdo. Continuemos...")


async def imagen(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id

    if _is_rate_limited(user_id):
        await update.message.reply_text("⏱️ Por favor espera un momento antes de enviar otro comando.")
        return

    if not _features.get('generacion_imagenes', False):
        await update.message.reply_text("❌ La generación de imágenes no está disponible en tu plan.")
        return

    prompt = ' '.join(context.args).strip() if context.args else ''
    if not prompt:
        await update.message.reply_text(
            "🎨 *Generación de Imágenes con IA*\n\n"
            "Uso: `/imagen <descripción de lo que quieres>`\n\n"
            "Ejemplos:\n"
            "• `/imagen un vestido rojo elegante sobre fondo blanco`\n"
            "• `/imagen banner publicitario de ropa de verano`\n"
            "• `/imagen catálogo de blusas floreadas estilo boutique`",
            parse_mode='Markdown',
        )
        return

    await update.message.chat.send_action("upload_photo")
    img_cfg = _client_config.get('generacion_imagenes', {})
    intro = img_cfg.get('intro_message', '🎨 Generando tu imagen, espera un momento...')
    await update.message.reply_text(intro)

    logger.info(f'Image request from user {user_id}: {prompt}')
    result = await bot_manager.generate_image(prompt)
    await _send_image_result(update, result, prompt)


async def reset(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id

    if user_id in conversations:
        del conversations[user_id]
    if user_id in user_data:
        user_data[user_id]['stage'] = 'greeting'

    logger.info(f'Conversation reset for user {user_id}')
    await update.message.reply_text(
        "🔄 Conversación reiniciada!\n"
        "Podemos empezar de nuevo. ¿En qué puedo ayudarte?"
    )


async def periodic_cleanup():
    while True:
        await asyncio.sleep(3600)
        cleanup_old_conversations()
        logger.info("Cleanup task completed")


async def post_init(_application) -> None:
    """Called once after the bot application is built — loads config before polling starts."""
    await load_client_config()


def main():
    token = BOT_TOKEN
    if not token:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN not found in .env")
        return

    app = Application.builder().token(token).post_init(post_init).build()

    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CommandHandler("imagen", imagen))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info("🤖 Sales Bot started. Press Ctrl+C to stop.")
    app.run_polling()


if __name__ == "__main__":
    main()
