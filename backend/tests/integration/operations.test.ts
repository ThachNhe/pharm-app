import request from 'supertest';
import faker from 'faker';
import moment from 'moment';
import httpStatus from 'http-status';
import app from '../../src/app.js';
import config from '../../src/config/config.js';
import { prisma } from '../../src/config/database.js';
import { tokenTypes } from '../../src/config/tokens.js';
import * as tokenService from '../../src/services/token.service.js';
import setupTestDB from '../utils/setupTestDB.js';
import { userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';

setupTestDB();

const accessToken = (userId: string) =>
  tokenService.generateToken(userId, moment().add(config.jwt.accessExpirationMinutes, 'minutes'), tokenTypes.ACCESS);

const futureDate = (days: number) => moment().add(days, 'days').format('YYYY-MM-DD');

describe('Store operations flow', () => {
  test('should complete import, sell FEFO, update inventory, and report gross profit', async () => {
    await insertUsers([userOne, userTwo]);
    const store = await prisma.store.create({ data: { name: 'Flow store' } });
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: store.id, role: 'owner' },
        { userId: userTwo.id, storeId: store.id, role: 'staff' },
      ],
    });

    const ownerToken = accessToken(userOne.id);
    const staffToken = accessToken(userTwo.id);
    const importedAt = moment().subtract(2, 'days').format('YYYY-MM-DD');

    const supplierRes = await request(app)
      .post(`/v1/stores/${store.id}/suppliers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'NCC-01',
        name: 'Nhà cung cấp kiểm thử',
        phone: '0900000000',
      })
      .expect(httpStatus.CREATED);

    const medicineRes = await request(app)
      .post(`/v1/stores/${store.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        name: 'Paracetamol 500mg',
        baseUnitName: 'Viên',
        barcode: faker.random.alphaNumeric(12),
        activeIngredient: 'Paracetamol',
        sellingPrice: 2000,
        minStock: 20,
      })
      .expect(httpStatus.CREATED);

    const importRes = await request(app)
      .post(`/v1/stores/${store.id}/imports`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        supplierId: supplierRes.body.id,
        importedAt,
        items: [
          {
            medicineId: medicineRes.body.id,
            batchNumber: 'LO-GAN',
            quantity: 30,
            importPrice: 800,
            expiryDate: futureDate(60),
          },
          {
            medicineId: medicineRes.body.id,
            batchNumber: 'LO-XA',
            quantity: 70,
            importPrice: 1000,
            expiryDate: futureDate(365),
          },
        ],
      })
      .expect(httpStatus.CREATED);

    expect(importRes.body).toMatchObject({
      status: 'draft',
      totalAmount: 94000,
    });
    expect(await prisma.stockBatch.count()).toBe(0);

    const completedRes = await request(app)
      .post(`/v1/stores/${store.id}/imports/${importRes.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(httpStatus.OK);

    expect(completedRes.body.status).toBe('completed');
    expect(completedRes.body.importedAt.slice(0, 10)).toBe(importedAt);
    expect(await prisma.stockBatch.count()).toBe(2);
    expect(await prisma.inventoryMovement.count({ where: { type: 'import' } })).toBe(2);

    await request(app)
      .post(`/v1/stores/${store.id}/imports/${importRes.body.id}/complete`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(httpStatus.CONFLICT);

    const inventoryBeforeSale = await request(app)
      .get(`/v1/stores/${store.id}/inventory`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);

    expect(inventoryBeforeSale.body.results[0]).toMatchObject({
      id: medicineRes.body.id,
      totalStock: 100,
      availableStock: 100,
    });
    expect(inventoryBeforeSale.body.results[0]).not.toHaveProperty('inventoryValue');
    expect(inventoryBeforeSale.body.results[0].batches[0]).not.toHaveProperty('importPrice');

    const staffDashboard = await request(app)
      .get(`/v1/stores/${store.id}/dashboard`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);

    expect(staffDashboard.body.today).not.toHaveProperty('cost');
    expect(staffDashboard.body.today).not.toHaveProperty('grossProfit');
    expect(staffDashboard.body.inventory).not.toHaveProperty('value');

    const saleRes = await request(app)
      .post(`/v1/stores/${store.id}/sales`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        paymentMethod: 'cash',
        discountAmount: 10000,
        items: [{ medicineId: medicineRes.body.id, quantity: 40 }],
      })
      .expect(httpStatus.CREATED);

    expect(saleRes.body).toMatchObject({
      totalAmount: 70000,
      discountAmount: 10000,
      status: 'completed',
    });
    expect(saleRes.body.details).toHaveLength(2);
    expect(saleRes.body.details[0]).toMatchObject({
      quantity: 30,
    });
    expect(saleRes.body.details[1]).toMatchObject({
      quantity: 10,
    });
    expect(saleRes.body.details[0]).not.toHaveProperty('costPrice');
    expect(saleRes.body.details[1]).not.toHaveProperty('costPrice');

    const ownerSaleRes = await request(app)
      .get(`/v1/stores/${store.id}/sales/${saleRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(httpStatus.OK);
    expect(ownerSaleRes.body.details[0]).toMatchObject({
      quantity: 30,
      costPrice: 800,
    });
    expect(ownerSaleRes.body.details[1]).toMatchObject({
      quantity: 10,
      costPrice: 1000,
    });

    const inventoryAfterSale = await request(app)
      .get(`/v1/stores/${store.id}/inventory`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);

    expect(inventoryAfterSale.body.results[0]).toMatchObject({
      totalStock: 60,
      availableStock: 60,
    });

    const reportRes = await request(app)
      .get(`/v1/stores/${store.id}/reports/profit`)
      .query({
        from: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        to: moment().add(1, 'day').format('YYYY-MM-DD'),
      })
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(httpStatus.OK);

    expect(reportRes.body.totals).toMatchObject({
      revenue: 70000,
      cost: 34000,
      grossProfit: 36000,
      orders: 1,
    });
    expect(reportRes.body.topMedicines[0]).toMatchObject({
      id: medicineRes.body.id,
      quantity: 40,
      grossProfit: 36000,
    });

    const saleCount = await prisma.sale.count();
    await request(app)
      .post(`/v1/stores/${store.id}/sales`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        paymentMethod: 'cash',
        items: [{ medicineId: medicineRes.body.id, quantity: 100 }],
      })
      .expect(httpStatus.CONFLICT);

    expect(await prisma.sale.count()).toBe(saleCount);
    const remaining = await prisma.stockBatch.aggregate({
      where: { storeId: store.id, medicineId: medicineRes.body.id },
      _sum: { quantityRemaining: true },
    });
    expect(Number(remaining._sum.quantityRemaining)).toBe(60);
  });

  test('should enforce store role and cross-store boundaries', async () => {
    await insertUsers([userOne, userTwo]);
    const [managedStore, otherStore] = await Promise.all([
      prisma.store.create({ data: { name: 'Managed store' } }),
      prisma.store.create({ data: { name: 'Other store' } }),
    ]);
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: managedStore.id, role: 'owner' },
        { userId: userTwo.id, storeId: managedStore.id, role: 'staff' },
      ],
    });

    const staffToken = accessToken(userTwo.id);

    await request(app)
      .post(`/v1/stores/${managedStore.id}/suppliers`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Không được tạo' })
      .expect(httpStatus.FORBIDDEN);

    await request(app)
      .get(`/v1/stores/${managedStore.id}/reports/profit`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);

    await request(app)
      .get(`/v1/stores/${otherStore.id}/inventory`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);
  });

  test('should expose only one membership per user and store', async () => {
    await insertUsers([userOne]);
    const store = await prisma.store.create({ data: { name: 'Unique role store' } });
    await prisma.userStoreRole.create({
      data: { userId: userOne.id, storeId: store.id, role: 'owner' },
    });

    await expect(
      prisma.userStoreRole.create({
        data: { userId: userOne.id, storeId: store.id, role: 'staff' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
