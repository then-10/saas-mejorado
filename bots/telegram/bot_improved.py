import logging
import os
import asyncio
import aiohttp
from datetime import datetime
from typing import Optional
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    filters,
    ContextTypes,
    CallbackQueryHandler,
)
from anthropic import Anthropic
from logging.handlers import RotatingFileHandler

load_dotenv()

logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

file_handler = RotatingFileHandler('bot.log', maxBytes=10_000_000, backupCount=10)
file_handler.setFormatter(
    logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
)
logger.addHandler(file_handler)

# ── Runtime state (populated at startup from admin panel) ──────────────────────
_client_config: dict = {}
_features: dict = {}
anthropic_client: Optional[Anthropic] = None

# ── Env vars ───────────────────────────────────────────────────────────────────
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000/api')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
CLIENT_ID = os.getenv('CLIENT_ID', '')
BOT_API_SECRET = os.getenv('BOT_API_SECRET', '')
ADMIN_PANEL_URL = os.getenv('ADMIN_PANEL_URL', 'https://saas-admin-panel.up.railway.app')

DEFAULT_IMAGE_KEYWORDS = ['imagen', 'foto', 'diseña', 'crea una imagen', 'genera', 'ilustra']

conversations: dict = {}
user_data: dict = {}
user_last_message_time: dict = {}


# ── Anthropic helpers ──────────────────────────────────────────────────────────

def _init_anthropic(api_key: str) -> None:
    global anthropic_client
    if api_key:
        try:
            anthropic_client = Anthropic(api_key=api_key)
            logger.info('Anthropic client initialized')
        except Exception as e:
            logger.error(f'Failed to initialize Anthropic client: {e}')
            anthropic_client = None
    else:
        anthropic_client = None
        logger.warning('No Anthropic API key — IA features disabled')


def _is_ia_enabled() -> bool:
    return bool(_features.get('chatbot_ia')) and anthropic_client is not None


def _is_image_gen_enabled() -> bool:
    return bool(_features.get('generacion_imagenes'))


def _get_system_prompt() -> str:
    custom = _client_config.get('chatbot_ia', {}).get('system_prompt', '').strip()
    if custom:
        return custom
    return (
        'Eres un asistente de ventas experto ayudando a calificar leads y gestionar '
        'oportunidades de venta. Eres amable, profesional y enfocado en entender las '
        'necesidades del cliente.\n'
        'Cuando identifiques un potencial lead:\n'
        '1. Recopila información: nombre, empresa, necesidad principal\n'
        '2. Califica el lead (alto/medio/bajo)\n'
        '3. Sugiere próximos pasos\n'
        'Responde siempre en español.'
    )


def _get_welcome_message(user_name: str) -> str:
    bot_desc = _client_config.get('telegram', {}).get('bot_description', '').strip()
    if bot_desc:
        return f'¡Hola {user_name}! 👋\n\n{bot_desc}\n\nEscribe /reset para limpiar la conversación.'
    welcome = _client_config.get('chatbot_basico', {}).get('welcome_message', '').strip()
    if welcome:
        return f'¡Hola {user_name}! 👋\n\n{welcome}'
    return (
        f'¡Hola {user_name}! 👋\n\n'
        'Bienvenido a nuestro asistente virtual.\n\n'
        '¿En qué puedo ayudarte?\n'
        'Escribe /reset para limpiar la conversación.'
    )


def _get_image_keywords() -> list:
    raw = _client_config.get('generacion_imagenes', {}).get('trigger_keywords', '').strip()
    if raw:
        return [k.strip().lower() for k in raw.split(',') if k.strip()]
    return DEFAULT_IMAGE_KEYWORDS


# ── Config loading (called once at startup via post_init) ──────────────────────

async def load_client_config() -> None:
    global _client_config, _features
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
                timeout=aiohttp.ClientTimeout(total=15),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    _features = data.get('features', {})
                    _client_config = data.get('config', {})
                    logger.info(
                        f'Config loaded for client "{data.get("clientName", CLIENT_ID)}". '
                        f'Enabled features: {[k for k, v in _features.items() if v]}'
                    )
                else:
                    body = await resp.text()
                    logger.error(f'bot-config returned HTTP {resp.status}: {body}')
    except Exception as e:
        logger.error(f'Failed to load client config from admin panel: {e}')

    api_key = (
        _client_config.get('chatbot_ia', {}).get('anthropic_api_key', '').strip()
        or os.getenv('ANTHROPIC_API_KEY', '')
    )
    _init_anthropic(api_key)


async def post_init(_application: Application) -> None:
    await load_client_config()


# ── SalesBotManager ────────────────────────────────────────────────────────────

def cleanup_old_conversations() -> None:
    for uid in list(conversations.keys()):
        if len(conversations[uid]) > 50:
            conversations[uid] = conversations[uid][-50:]


class SalesBotManager:
    def __init__(self, api_base_url: str) -> None:
        self.api_base_url = api_base_url
        self.session: Optional[aiohttp.ClientSession] = None

    async def init_session(self) -> None:
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def close_session(self) -> None:
        if self.session:
            await self.session.close()

    async def create_lead(self, udata: dict) -> Optional[dict]:
        await self.init_session()
        try:
            async with self.session.post(  # type: ignore[union-attr]
                f'{self.api_base_url}/leads',
                json={
                    'source': 'telegram',
                    'first_name': udata.get('first_name'),
                    'title': udata.get('title'),
                    'phone': udata.get('phone'),
                    'email': udata.get('email'),
                    'description': udata.get('description'),
                    'value': udata.get('value'),
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY", "")}'},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as response:
                if response.status == 201:
                    return await response.json()
                return None
        except Exception as e:
            logger.error(f'Error creating lead: {e}')
            return None

    async def log_interaction(self, user_id: int, message: str, response: str) -> bool:
        await self.init_session()
        try:
            async with self.session.post(  # type: ignore[union-attr]
                f'{self.api_base_url}/chat-logs',
                json={
                    'channel': 'telegram',
                    'sender_id': str(user_id),
                    'message': message,
                    'response': response,
                    'timestamp': datetime.now().isoformat(),
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY", "")}'},
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return resp.status == 201
        except Exception as e:
            logger.error(f'Error logging interaction: {e}')
            return False


bot_manager = SalesBotManager(API_BASE_URL)


# ── Command handlers ───────────────────────────────────────────────────────────

async def start(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    user_id = user.id
    user_name = user.first_name

    if user_id not in user_data:
        user_data[user_id] = {
            'first_name': user_name,
            'telegram_id': user_id,
            'stage': 'greeting',
        }

    await update.message.reply_text(_get_welcome_message(user_name))


async def reset(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    conversations.pop(user_id, None)
    if user_id in user_data:
        user_data[user_id]['stage'] = 'greeting'
    logger.info(f'Conversation reset for user {user_id}')
    await update.message.reply_text('🔄 Conversación reiniciada!\n¿En qué puedo ayudarte?')


async def imagen(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    if not _is_image_gen_enabled():
        await update.message.reply_text('Esta función no está disponible en tu plan actual.')
        return
    img_cfg = _client_config.get('generacion_imagenes', {})
    await update.message.reply_text(
        img_cfg.get('intro_message', '🎨 Escribe la descripción de la imagen que quieres generar.')
    )


# ── Message handler ────────────────────────────────────────────────────────────

async def handle_message(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    user_id = update.effective_user.id
    user_message = update.message.text

    if not user_message or not user_message.strip():
        await update.message.reply_text('Por favor escribe un mensaje válido.')
        return

    # Rate limiting: max 1 message per 2 seconds
    now = datetime.now()
    if user_id in user_last_message_time:
        if (now - user_last_message_time[user_id]).total_seconds() < 2:
            await update.message.reply_text('⏱️ Por favor espera un momento antes de enviar otro mensaje.')
            return
    user_last_message_time[user_id] = now

    await update.message.chat.send_action('typing')

    if user_id not in conversations:
        conversations[user_id] = []
    if user_id not in user_data:
        user_data[user_id] = {'telegram_id': user_id}

    # Image generation via keyword detection
    if _is_image_gen_enabled():
        msg_lower = user_message.lower()
        if any(kw in msg_lower for kw in _get_image_keywords()):
            await handle_image_generation(update, user_message)
            return

    # IA chatbot
    if not _is_ia_enabled():
        await update.message.reply_text(
            'Lo siento, el asistente con IA no está disponible en este momento. '
            'Por favor contacta al soporte.'
        )
        return

    conversations[user_id].append({'role': 'user', 'content': user_message})

    try:
        logger.info(f'User {user_id}: {user_message[:80]}')
        response = anthropic_client.messages.create(  # type: ignore[union-attr]
            model='claude-sonnet-4-20250514',
            max_tokens=1024,
            system=_get_system_prompt(),
            messages=conversations[user_id],
        )
        assistant_message = response.content[0].text

        conversations[user_id].append({'role': 'assistant', 'content': assistant_message})
        if len(conversations[user_id]) > 20:
            conversations[user_id] = conversations[user_id][-20:]

        logger.info(f'Response sent to user {user_id}')
        await bot_manager.log_interaction(user_id, user_message, assistant_message)
        await update.message.reply_text(assistant_message)

        if any(w in user_message.lower() for w in ['interesado', 'necesito', 'quiero', 'cotización']):
            await suggest_lead_creation(update, user_id)

    except Exception as e:
        logger.error(f'Error processing message from {user_id}: {e}')
        await update.message.reply_text('❌ Error al procesar tu mensaje. Por favor intenta de nuevo.')


async def handle_image_generation(update: Update, prompt: str) -> None:
    img_cfg = _client_config.get('generacion_imagenes', {})
    intro = img_cfg.get('intro_message', '🎨 Generando tu imagen, espera un momento...')
    error_msg = img_cfg.get(
        'error_message',
        'Lo siento, no pude generar esa imagen. Intenta con una descripción diferente.',
    )
    limit_msg = img_cfg.get(
        'limit_reached_message',
        'Has alcanzado el límite de imágenes por hoy. Vuelve mañana.',
    )

    await update.message.reply_text(intro)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f'{ADMIN_PANEL_URL}/api/image-gen',
                json={'clientId': CLIENT_ID, 'prompt': prompt, 'channel': 'telegram'},
                headers={
                    'Authorization': f'Bearer {BOT_API_SECRET}',
                    'Content-Type': 'application/json',
                },
                timeout=aiohttp.ClientTimeout(total=60),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    image_url = data.get('imageUrl', '')
                    if image_url:
                        await update.message.reply_photo(photo=image_url)
                        return
                elif resp.status == 429:
                    await update.message.reply_text(limit_msg)
                    return
                body = await resp.text()
                logger.error(f'image-gen returned {resp.status}: {body}')
    except Exception as e:
        logger.error(f'Image generation error: {e}')

    await update.message.reply_text(error_msg)


async def suggest_lead_creation(update: Update, _user_id: int) -> None:
    keyboard = [
        [InlineKeyboardButton('📋 Registrar Lead', callback_data='create_lead')],
        [InlineKeyboardButton('❌ No, gracias', callback_data='skip_lead')],
    ]
    await update.message.reply_text(
        '¿Deseas registrar esto como un nuevo lead en nuestro sistema?',
        reply_markup=InlineKeyboardMarkup(keyboard),
    )


# ── Callback handler ───────────────────────────────────────────────────────────

async def handle_callback(update: Update, _context: ContextTypes.DEFAULT_TYPE) -> None:
    query = update.callback_query
    user_id = query.from_user.id
    await query.answer()

    if query.data == 'qualify_lead':
        await query.edit_message_text(
            'Perfecto! Voy a recopilar información para calificar el lead.\n'
            '¿Cuál es el nombre de la persona/empresa?'
        )
    elif query.data == 'create_lead':
        lead = await bot_manager.create_lead(user_data.get(user_id, {}))
        if lead:
            await query.edit_message_text(
                f"✅ Lead registrado exitosamente!\nID: {lead.get('id')}\n"
                'Se notificará al equipo de ventas.'
            )
        else:
            await query.edit_message_text('❌ Error al registrar el lead. Intenta de nuevo.')
    elif query.data == 'check_status':
        await query.edit_message_text(
            '📊 Estado de tus leads:\n'
            '• Leads activos: 3\n'
            '• Seguimiento pendiente: 2\n'
            '• Cerrados: 1'
        )
    elif query.data == 'help':
        img_line = '\n/imagen - Generar imagen con IA' if _is_image_gen_enabled() else ''
        await query.edit_message_text(
            '📚 Guía de uso:\n'
            '/start - Iniciar\n'
            '/reset - Limpiar conversación'
            + img_line +
            '\n\nEscribe cualquier pregunta y te ayudaré.'
        )
    elif query.data == 'skip_lead':
        await query.edit_message_text('De acuerdo. Continuemos...')


# ── Periodic cleanup ───────────────────────────────────────────────────────────

async def periodic_cleanup() -> None:
    while True:
        await asyncio.sleep(3600)
        cleanup_old_conversations()
        logger.info('Periodic cleanup completed')


# ── Entry point ────────────────────────────────────────────────────────────────

def main() -> None:
    if not BOT_TOKEN:
        print('❌ ERROR: TELEGRAM_BOT_TOKEN not found in environment')
        return

    app = (
        Application.builder()
        .token(BOT_TOKEN)
        .post_init(post_init)
        .build()
    )

    app.add_handler(CommandHandler('start', start))
    app.add_handler(CommandHandler('reset', reset))
    app.add_handler(CommandHandler('imagen', imagen))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    logger.info('🤖 Bot started. Press Ctrl+C to stop.')
    app.run_polling()


if __name__ == '__main__':
    main()
