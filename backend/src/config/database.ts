import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import config from './config.js';
import logger from './logger.js';

const adapter = new PrismaPg({
  connectionString: config.database.url,
});

const prisma = new PrismaClient({
  adapter,
  log: config.env === 'development' && config.database.logging ? ['query', 'warn', 'error'] : ['error'],
});

const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('Connected to PostgreSQL database');
  } catch (error) {
    logger.error('Unable to connect to database:', error);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  await prisma.$disconnect();
};

export { prisma, connectDB, disconnectDB };
