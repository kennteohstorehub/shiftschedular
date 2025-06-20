const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const cron = require('node-cron');

// Import routes
const authRoutes = require('./routes/auth');
const agentRoutes = require('./routes/agents');
const scheduleRoutes = require('./routes/schedules');
const forecastRoutes = require('./routes/forecasts');
const shiftRoutes = require('./routes/shifts');
const analyticsRoutes = require('./routes/analytics');

// Import services
const { sequelize } = require('./models');
const ForecastService = require('./services/ForecastService');
const ScheduleOptimizer = require('./services/ScheduleOptimizer');
const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/forecasts', forecastRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/analytics', analyticsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client/build')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'client/build', 'index.html'));
  });
}

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);
  
  socket.on('join-room', (room) => {
    socket.join(room);
    logger.info(`Client ${socket.id} joined room: ${room}`);
  });
  
  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Scheduled tasks
// Run forecasting every hour
cron.schedule('0 * * * *', async () => {
  try {
    logger.info('Running hourly forecast update');
    await ForecastService.updateHourlyForecasts();
    io.emit('forecast-updated', { timestamp: new Date() });
  } catch (error) {
    logger.error('Error in hourly forecast update:', error);
  }
});

// Run schedule optimization daily at 2 AM
cron.schedule('0 2 * * *', async () => {
  try {
    logger.info('Running daily schedule optimization');
    await ScheduleOptimizer.optimizeDailySchedules();
    io.emit('schedules-optimized', { timestamp: new Date() });
  } catch (error) {
    logger.error('Error in daily schedule optimization:', error);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Database sync and server start
async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
    
    // Sync database models
    await sequelize.sync({ alter: true });
    logger.info('Database models synchronized');
    
    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Unable to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, io }; 