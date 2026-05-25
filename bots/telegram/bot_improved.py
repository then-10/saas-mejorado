import logging
import os
import asyncio
import aiohttp
from datetime import datetime, timedelta
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes, CallbackQueryHandler
from anthropic import Anthropic
from logging.handlers import RotatingFileHandler

# Load environment variables
load_dotenv()

# Configure logging with file rotation
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Add file handler for persistent logging
file_handler = RotatingFileHandler('bot.log', maxBytes=10000000, backupCount=10)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

# Initialize Claude client
client = Anthropic()

# Store conversations per user
conversations = {}
user_data = {}
user_last_message_time = {}  # For rate limiting

# API Configuration
API_BASE_URL = os.getenv('API_BASE_URL', 'http://localhost:3000/api')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

# Cleanup old conversations to prevent memory leaks
def cleanup_old_conversations():
    """Clean up old conversations to prevent memory leaks"""
    for user_id in list(conversations.keys()):
        if len(conversations[user_id]) > 50:  # Keep only last 50 messages per user
            conversations[user_id] = conversations[user_id][-50:]

class SalesBotManager:
    """Manages bot interactions with the SaaS backend"""

    def __init__(self, api_base_url: str):
        self.api_base_url = api_base_url
        self.session = None

    async def init_session(self):
        """Initialize aiohttp session"""
        if self.session is None:
            self.session = aiohttp.ClientSession()

    async def close_session(self):
        """Close aiohttp session"""
        if self.session:
            await self.session.close()

    async def create_lead(self, user_data: dict):
        """Create a lead from telegram conversation"""
        await self.init_session()
        try:
            async with self.session.post(
                f'{self.api_base_url}/leads',
                json={
                    'source': 'telegram',
                    'first_name': user_data.get('first_name'),
                    'title': user_data.get('title'),
                    'phone': user_data.get('phone'),
                    'email': user_data.get('email'),
                    'description': user_data.get('description'),
                    'value': user_data.get('value')
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY")}'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                if response.status == 201:
                    return await response.json()
                return None
        except Exception as e:
            logger.error(f'Error creating lead: {str(e)}')
            return None

    async def log_interaction(self, user_id: int, message: str, response: str):
        """Log chat interaction to database"""
        await self.init_session()
        try:
            async with self.session.post(
                f'{self.api_base_url}/chat-logs',
                json={
                    'channel': 'telegram',
                    'sender_id': str(user_id),
                    'message': message,
                    'response': response,
                    'timestamp': datetime.now().isoformat()
                },
                headers={'Authorization': f'Bearer {os.getenv("API_KEY")}'},
                timeout=aiohttp.ClientTimeout(total=10)
            ) as response:
                return response.status == 201
        except Exception as e:
            logger.error(f'Error logging interaction: {str(e)}')
            return False

bot_manager = SalesBotManager(API_BASE_URL)

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Start command handler"""
    user_name = update.effective_user.first_name
    user_id = update.effective_user.id

    # Initialize user data
    if user_id not in user_data:
        user_data[user_id] = {
            'first_name': user_name,
            'telegram_id': user_id,
            'stage': 'greeting'
        }

    keyboard = [
        [InlineKeyboardButton("📋 Calificar Lead", callback_data='qualify_lead')],
        [InlineKeyboardButton("📊 Ver Estado", callback_data='check_status')],
        [InlineKeyboardButton("ℹ️ Ayuda", callback_data='help')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        f"¡Hola {user_name}! 👋\n\n"
        "Bienvenido a nuestro Bot de Ventas con IA.\n\n"
        "¿Qué deseas hacer?\n"
        "• Consultarme sobre productos\n"
        "• Registrar un nuevo lead\n"
        "• Obtener información de ventas\n\n"
        "Escribe /reset para limpiar nuestra conversación",
        reply_markup=reply_markup
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle user messages with Claude AI"""
    user_id = update.effective_user.id
    user_message = update.message.text

    # Input validation
    if not user_message or not user_message.strip():
        await update.message.reply_text("Por favor escribe un mensaje válido.")
        return

    # Rate limiting: max 1 message per 2 seconds
    now = datetime.now()
    if user_id in user_last_message_time:
        time_diff = (now - user_last_message_time[user_id]).total_seconds()
        if time_diff < 2:
            await update.message.reply_text("⏱️ Por favor espera un momento antes de enviar otro mensaje.")
            return

    user_last_message_time[user_id] = now

    # Show typing indicator
    await update.message.chat.send_action("typing")

    # Initialize conversation if new
    if user_id not in conversations:
        conversations[user_id] = []
    if user_id not in user_data:
        user_data[user_id] = {'telegram_id': user_id}

    # Add user message
    conversations[user_id].append({
        "role": "user",
        "content": user_message
    })

    try:
        logger.info(f'User {user_id}: {user_message}')

        # Prepare system context
        system_prompt = """Eres un asistente de ventas experto ayudando a calificar leads y gestionar oportunidades de venta.
Eres amable, profesional y enfocado en entender las necesidades del cliente.
Cuando identifiques un potencial lead:
1. Recopila información: nombre, empresa, necesidad principal
2. Califica el lead (alto/medio/bajo)
3. Sugiere próximos pasos
Responde siempre en español."""

        # ✅ FIXED: Changed from claude-opus-4-20250805 (non-existent) to claude-sonnet-4-20250514
        # Call Claude API
        response = client.messages.create(
            model="claude-sonnet-4-20250514",  # ✅ CORRECTED: Valid model
            max_tokens=1024,
            system=system_prompt,
            messages=conversations[user_id]
        )

        # Extract response
        assistant_message = response.content[0].text

        # Add to conversation history
        conversations[user_id].append({
            "role": "assistant",
            "content": assistant_message
        })

        # Keep only last 20 messages per user (cleanup)
        if len(conversations[user_id]) > 20:
            conversations[user_id] = conversations[user_id][-20:]

        logger.info(f'Response sent to user {user_id}')

        # Log interaction asynchronously
        await bot_manager.log_interaction(user_id, user_message, assistant_message)

        # Send response
        await update.message.reply_text(assistant_message)

        # Check if we should create a lead
        if any(word in user_message.lower() for word in ['interesado', 'necesito', 'quiero', 'cotización']):
            await suggest_lead_creation(update, context, user_id)

    except Exception as e:
        logger.error(f'Error processing message from {user_id}: {str(e)}')
        await update.message.reply_text(
            "❌ Error al procesar tu mensaje.\n"
            "Por favor intenta de nuevo."
        )

async def suggest_lead_creation(update: Update, context: ContextTypes.DEFAULT_TYPE, user_id: int):
    """Suggest lead creation when user shows interest"""
    keyboard = [
        [InlineKeyboardButton("📋 Registrar Lead", callback_data='create_lead')],
        [InlineKeyboardButton("❌ No, gracias", callback_data='skip_lead')]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)

    await update.message.reply_text(
        "¿Deseas registrar esto como un nuevo lead en nuestro sistema?",
        reply_markup=reply_markup
    )

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle inline keyboard callbacks"""
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
            await query.edit_message_text(
                "❌ Error al registrar el lead. Intenta de nuevo."
            )
    elif query.data == 'check_status':
        await query.edit_message_text(
            "📊 Estado de tus leads:\n"
            "• Leads activos: 3\n"
            "• Seguimiento pendiente: 2\n"
            "• Cerrados: 1"
        )
    elif query.data == 'help':
        await query.edit_message_text(
            "📚 Guía de USO:\n"
            "Comandos disponibles: *\n"
            "/start - Iniciar\n"
            "/reset - Limpiar conversación\n"
            "/help - Esta ayuda\n\n"
            "Escribe cualquier pregunta sobre productos, precios, etc."
        )
    elif query.data == 'skip_lead':
        await query.edit_message_text("De acuerdo. Continuemos...")

async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Reset conversation"""
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

# Periodic cleanup task
async def periodic_cleanup():
    """Run periodic cleanup to prevent memory leaks"""
    while True:
        await asyncio.sleep(3600)  # Run every hour
        cleanup_old_conversations()
        logger.info("Cleanup task completed")

def main():
    """Start the bot"""
    token = BOT_TOKEN

    if not token:
        print("❌ ERROR: TELEGRAM_BOT_TOKEN not found in .env")
        return

    # Create application
    app = Application.builder().token(token).build()

    # Add handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CallbackQueryHandler(handle_callback))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))

    # Start
    logger.info("🤖 Sales Bot started. Press Ctrl+C to stop.")
    app.run_polling()

if __name__ == "__main__":
    main()
