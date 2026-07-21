import { prisma, disconnectDB } from '../config/database.js';

const setupTestDB = () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  beforeEach(async () => {
    await prisma.auditLog.deleteMany();
    await prisma.saleDetail.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.inventoryMovement.deleteMany();
    await prisma.stockBatch.deleteMany();
    await prisma.importDetail.deleteMany();
    await prisma.importReceipt.deleteMany();
    await prisma.storeMedicine.deleteMany();
    await prisma.medicineUnit.deleteMany();
    await prisma.medicine.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.dailyProfitSummary.deleteMany();
    await prisma.userStoreRole.deleteMany();
    await prisma.token.deleteMany();
    await prisma.user.deleteMany();
    await prisma.store.deleteMany();
  });

  afterAll(async () => {
    await disconnectDB();
  });
};

export default setupTestDB;
