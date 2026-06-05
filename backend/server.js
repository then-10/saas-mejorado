require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const morgan = require('morgan');

// Import routes
const authRoutes = require('./routes/auth');
const leadsRoutes = require('./routes/leads');
const pipelineRoutes = require('./routes/pipeline');
const contactsRoutes = require('./routes/contacts');
const analyticsRoutes = require('./routes/analytics');
const webhooksRoutes = require('./routes/webhooks');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'SaaS-Mejorado running',
    timestamp: new Date(),
    version: '2.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/teams', teamsRoutes);

// Webhook routes
app.use('/webhook/telegram', webhooksRoutes.telegram);
app.use('/webhook/whatsapp', webhooksRoutes.whatsapp);
app.use('/webhook/bitrix24', webhooksRoutes.bitrix24);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found', path: req.path });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({
    error: message,
    timestamp: new Date(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});
// ===================================
// TELEGRAM BOT WEBHOOK HANDLER
// ===================================

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const message = req.body.message;
    const callbackQuery = req.body.callback_query;

    // Ignorar actualizaciones que no tengan mensaje ni callback
    if (!message && !callbackQuery) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message ? message.chat.id : callbackQuery.message.chat.id;
    const text = message ? message.text : null;
    const userId = message ? message.from.id : callbackQuery.from.id;

    console.log(`[Telegram] Mensaje de ${chatId}: ${text}`);

    // Obtener configuración del cliente
    // (Busca el cliente que corresponde a este chat de Telegram)
    const clients = await Client.findMany();
    const client = clients[0]; // Por ahora usa el primer cliente

    if (!client) {
      console.log('[Telegram] Cliente no encontrado');
      return res.status(200).json({ ok: true });
    }

    // COMANDO /start
    if (text === '/start') {
      const welcomeMessage = `👋 Hola! Soy el asistente de ventas de ${client.name}.\n¿Cómo puedo ayudarte hoy?`;
      await sendTelegramMessage(chatId, welcomeMessage);
      return res.status(200).json({ ok: true });
    }

    // PROCESAR MENSAJES
    if (text) {
      // Registrar interacción
      try {
        await Interaction.create({
          data: {
            clientId: client.id,
            source: 'telegram',
            message: text,
            userId: userId.toString(),
          },
        });
      } catch (error) {
        console.error('Error registrando interacción:', error);
      }

      // Obtener configuración del chatbot
      const botConfig = await BotConfig.findFirst({
        where: { clientId: client.id },
      });

      if (botConfig && botConfig.enabled) {
        let response = '😊 Gracias por tu mensaje. Te contactaremos pronto con más información.';

        // Buscar respuesta en FAQ
        try {
          const faqItems = botConfig.faqItems || [];

          for (const item of faqItems) {
            if (text.toLowerCase().includes(item.question.toLowerCase())) {
              response = item.answer;
              break;
            }
          }
        } catch (error) {
          console.error('Error buscando FAQ:', error);
        }

        // Enviar respuesta
        await sendTelegramMessage(chatId, response);
      }
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Telegram] Error en webhook:', error);
    // Siempre responder 200 a Telegram para que no reintente
    res.status(200).json({ ok: true });
  }
});

// FUNCIÓN AUXILIAR: Enviar mensaje a Telegram
async function sendTelegramMessage(chatId, text) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    if (!botToken) {
      console.error('[Telegram] TELEGRAM_BOT_TOKEN no está configurado');
      return;
    }

    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[Telegram] Error enviando mensaje:', error);
    } else {
      console.log('[Telegram] Mensaje enviado exitosamente a', chatId);
    }
  } catch (error) {
    console.error('[Telegram] Error en sendTelegramMessage:', error);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SaaS-Mejorado API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Not configured'}`);
});

module.exports = app;
