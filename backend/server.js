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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SaaS-Mejorado API running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL?.split('@')[1] || 'Not configured'}`);
});

module.exports = app;
