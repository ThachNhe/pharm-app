import { prisma, disconnectDB } from '../config/database.js';

const setupTestDB = () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await disconnectDB();
  });
};

export default setupTestDB;
