const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('./logger');

const sequelize = new Sequelize(config.database.url, {
  dialect: config.database.dialect,
  logging: config.database.logging,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('Connected to PostgreSQL database');

    // Sync models in development
    if (config.env === 'development') {
      await sequelize.sync({ alter: true });
    }
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
