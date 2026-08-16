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
        isActive: true,
      })
      .expect(httpStatus.CREATED);

    expect(supplierRes.body.isActive).toBe(true);

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
        isActive: true,
      })
      .expect(httpStatus.CREATED);

    expect(medicineRes.body.isActive).toBe(true);

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

  test('should paginate the library and reuse a reference medicine across stores', async () => {
    await insertUsers([userOne, userTwo]);
    const [firstStore, secondStore, unrelatedStore] = await Promise.all([
      prisma.store.create({ data: { name: 'First library store' } }),
      prisma.store.create({ data: { name: 'Second library store' } }),
      prisma.store.create({ data: { name: 'Unrelated store' } }),
    ]);
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: firstStore.id, role: 'owner' },
        { userId: userOne.id, storeId: secondStore.id, role: 'owner' },
        { userId: userTwo.id, storeId: firstStore.id, role: 'staff' },
      ],
    });

    const search = `Library-${faker.random.alphaNumeric(8)}`;
    const sharedBarcode = faker.random.alphaNumeric(12);
    const fallbackBarcode = faker.random.alphaNumeric(12);
    const referenceProducts = [
      {
        id: faker.datatype.uuid(),
        code: `${search}-01`,
        name: `${search} A`,
        barcode: faker.random.alphaNumeric(12),
        manufacturer: 'Nhà sản xuất A',
        specification: 'Hộp 10 vỉ x 10 viên',
        referencePrice: 1500,
      },
      {
        id: faker.datatype.uuid(),
        code: `${search}-02`,
        name: `${search} B`,
        barcode: sharedBarcode,
        secondaryBarcode: faker.random.alphaNumeric(12),
        manufacturer: 'Nhà sản xuất B',
        referencePrice: 2000,
      },
      {
        id: faker.datatype.uuid(),
        code: `${search}-03`,
        name: `${search} C`,
        barcode: sharedBarcode,
        secondaryBarcode: fallbackBarcode,
        manufacturer: 'Nhà sản xuất C',
        referencePrice: 2500,
      },
    ];
    await prisma.referenceProduct.createMany({ data: referenceProducts });

    const ownerToken = accessToken(userOne.id);
    const staffToken = accessToken(userTwo.id);
    const libraryRes = await request(app)
      .get(`/v1/stores/${firstStore.id}/reference-products`)
      .query({ search, page: 2, limit: 1 })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);

    expect(libraryRes.body).toMatchObject({
      page: 2,
      limit: 1,
      totalPages: 3,
      totalResults: 3,
    });
    expect(libraryRes.body.results).toEqual([
      expect.objectContaining({
        id: referenceProducts[1].id,
        code: referenceProducts[1].code,
        referencePrice: 2000,
        isAddedToStore: false,
      }),
    ]);

    await request(app)
      .get(`/v1/stores/${unrelatedStore.id}/reference-products`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);

    const createPayload = {
      referenceProductId: referenceProducts[1].id,
      name: 'Tên giả từ client',
      baseUnitName: 'Viên',
      barcode: faker.random.alphaNumeric(12),
      manufacturer: 'Nhà sản xuất giả từ client',
      sellingPrice: 3000,
      minStock: 10,
      isActive: true,
    };
    const firstMedicineRes = await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createPayload)
      .expect(httpStatus.CREATED);
    expect(firstMedicineRes.body).toMatchObject({
      name: referenceProducts[1].name,
      barcode: referenceProducts[1].barcode,
      manufacturer: referenceProducts[1].manufacturer,
    });

    const secondMedicineRes = await request(app)
      .post(`/v1/stores/${secondStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...createPayload, sellingPrice: 3500, minStock: 20 })
      .expect(httpStatus.CREATED);

    expect(secondMedicineRes.body).toMatchObject({
      id: firstMedicineRes.body.id,
      referenceProductId: referenceProducts[1].id,
      sellingPrice: 3500,
      minStock: 20,
    });
    expect(secondMedicineRes.body.storeMedicineId).not.toBe(firstMedicineRes.body.storeMedicineId);
    expect(await prisma.medicine.count({ where: { referenceProductId: referenceProducts[1].id } })).toBe(1);
    expect(await prisma.storeMedicine.count({ where: { medicineId: firstMedicineRes.body.id } })).toBe(2);

    const duplicateBarcodeRes = await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...createPayload, referenceProductId: referenceProducts[2].id })
      .expect(httpStatus.CREATED);
    expect(duplicateBarcodeRes.body).toMatchObject({
      referenceProductId: referenceProducts[2].id,
      name: referenceProducts[2].name,
      barcode: fallbackBarcode,
    });

    await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createPayload)
      .expect(httpStatus.CONFLICT);

    await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ ...createPayload, referenceProductId: referenceProducts[0].id })
      .expect(httpStatus.FORBIDDEN);

    await request(app)
      .patch(`/v1/stores/${firstStore.id}/medicines/${firstMedicineRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Không được sửa tên dùng chung' })
      .expect(httpStatus.BAD_REQUEST);

    const updatedRes = await request(app)
      .patch(`/v1/stores/${firstStore.id}/medicines/${firstMedicineRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ sellingPrice: 4200, minStock: 15, isActive: false })
      .expect(httpStatus.OK);

    expect(updatedRes.body).toMatchObject({ sellingPrice: 4200, minStock: 15, isActive: false });
    const secondAssignment = await prisma.storeMedicine.findUniqueOrThrow({
      where: {
        storeId_medicineId: {
          storeId: secondStore.id,
          medicineId: firstMedicineRes.body.id,
        },
      },
    });
    expect(Number(secondAssignment.sellingPrice)).toBe(3500);
    expect(Number(secondAssignment.minStock)).toBe(20);
    expect(secondAssignment.isActive).toBe(true);

    const updatedLibraryRes = await request(app)
      .get(`/v1/stores/${firstStore.id}/reference-products`)
      .query({ search: referenceProducts[1].code })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);
    expect(updatedLibraryRes.body.results[0]).toMatchObject({ isAddedToStore: true });
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
