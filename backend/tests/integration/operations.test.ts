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
  test.each(['owner', 'manager'] as const)(
    'should complete import, sell FEFO, update inventory, and report gross profit as %s',
    async (role) => {
      await insertUsers([userOne, userTwo]);
      const store = await prisma.store.create({ data: { name: 'Flow store' } });
      await prisma.userStoreRole.createMany({
        data: [
          { userId: userOne.id, storeId: store.id, role },
          { userId: userTwo.id, storeId: store.id, role: 'staff' },
        ],
      });

      const ownerToken = accessToken(userOne.id);
      const staffToken = accessToken(userTwo.id);
      const importedAt = moment().subtract(2, 'days').format('YYYY-MM-DD');

      const categoryRes = await request(app)
        .post(`/v1/stores/${store.id}/product-categories`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Dược phẩm', description: 'Thuốc và dược phẩm' })
        .expect(httpStatus.CREATED);

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
          categoryId: categoryRes.body.id,
          positionName: 'Kệ A1',
          name: 'Paracetamol 500mg',
          baseUnitName: 'Viên',
          barcode: faker.random.alphaNumeric(12),
          secondaryBarcode: faker.random.alphaNumeric(12),
          activeIngredient: 'Paracetamol',
          countryOfOrigin: 'Việt Nam',
          importerName: 'Công ty nhập khẩu kiểm thử',
          specification: 'Hộp 10 vỉ x 10 viên',
          usageInstructions: 'Uống sau ăn',
          sellingPrice: 2000,
          isActive: true,
          units: [
            { name: 'Viên', conversionRate: 1, isBaseUnit: true },
            { name: 'Vỉ', conversionRate: 10, isBaseUnit: false },
          ],
        })
        .expect(httpStatus.CREATED);

      expect(medicineRes.body).toMatchObject({
        code: 'SP000001',
        positionName: 'Kệ A1',
        countryOfOrigin: 'Việt Nam',
        importerName: 'Công ty nhập khẩu kiểm thử',
        specification: 'Hộp 10 vỉ x 10 viên',
        usageInstructions: 'Uống sau ăn',
        isActive: true,
      });
      expect(medicineRes.body.units).toEqual([
        expect.objectContaining({ name: 'Viên', conversionRate: 1, isBaseUnit: true }),
        expect.objectContaining({ name: 'Vỉ', conversionRate: 10, isBaseUnit: false }),
      ]);
      const baseUnitId = medicineRes.body.units.find((unit) => unit.isBaseUnit).id;
      const blisterUnitId = medicineRes.body.units.find((unit) => unit.name === 'Vỉ').id;

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
              quantity: 3,
              importPrice: 8000,
              unitId: blisterUnitId,
              expiryDate: futureDate(60),
            },
            {
              medicineId: medicineRes.body.id,
              batchNumber: 'LO-XA',
              quantity: 70,
              importPrice: 1000,
              unitId: baseUnitId,
              expiryDate: futureDate(365),
            },
          ],
        })
        .expect(httpStatus.CREATED);

      expect(importRes.body).toMatchObject({
        status: 'draft',
        totalAmount: 94000,
      });
      expect(importRes.body.details[0]).toMatchObject({
        quantity: 3,
        importPrice: 8000,
        baseQuantity: 30,
        baseImportPrice: 800,
        unitName: 'Vỉ',
        conversionRate: 10,
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

      const staffMedicinesRes = await request(app)
        .get(`/v1/stores/${store.id}/medicines`)
        .set('Authorization', `Bearer ${staffToken}`)
        .expect(httpStatus.OK);
      expect(staffMedicinesRes.body.results[0]).toMatchObject({
        code: medicineRes.body.code,
        availableStock: 100,
        nearestExpiry: expect.any(String),
        batches: [
          expect.objectContaining({
            batchNumber: 'LO-GAN',
            quantityRemaining: 30,
          }),
          expect.objectContaining({
            batchNumber: 'LO-XA',
            quantityRemaining: 70,
          }),
        ],
      });
      expect(staffMedicinesRes.body.results[0]).not.toHaveProperty('inventoryValue');
      expect(staffMedicinesRes.body.results[0].batches[0]).not.toHaveProperty('importPrice');

      const ownerMedicinesRes = await request(app)
        .get(`/v1/stores/${store.id}/medicines`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(httpStatus.OK);
      expect(ownerMedicinesRes.body.results[0].inventoryValue).toBe(94000);
      expect(ownerMedicinesRes.body.results[0].batches[0]).toMatchObject({
        batchNumber: 'LO-GAN',
        importPrice: 800,
      });

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
        isLowStock: false,
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

      for (const invalidSale of [
        { items: [{ medicineId: medicineRes.body.id, quantity: 1.5, unitId: blisterUnitId }] },
        { discountAmount: 500.5, items: [{ medicineId: medicineRes.body.id, quantity: 1, unitId: blisterUnitId }] },
      ]) {
        await request(app)
          .post(`/v1/stores/${store.id}/sales`)
          .set('Authorization', `Bearer ${staffToken}`)
          .send({ paymentMethod: 'cash', ...invalidSale })
          .expect(httpStatus.BAD_REQUEST);
      }

      const stalePriceRes = await request(app)
        .post(`/v1/stores/${store.id}/sales`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          paymentMethod: 'cash',
          items: [{ medicineId: medicineRes.body.id, quantity: 4, unitId: blisterUnitId, expectedUnitPrice: 15000 }],
        })
        .expect(httpStatus.CONFLICT);
      expect(stalePriceRes.body.message).toContain('Giá bán đã thay đổi');
      expect(await prisma.sale.count({ where: { storeId: store.id } })).toBe(0);

      const saleRes = await request(app)
        .post(`/v1/stores/${store.id}/sales`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          paymentMethod: 'cash',
          discountAmount: 10000,
          items: [{ medicineId: medicineRes.body.id, quantity: 4, unitId: blisterUnitId, expectedUnitPrice: 20000 }],
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
        displayQuantity: 3,
        displaySalePrice: 20000,
        unitName: 'Vỉ',
        conversionRate: 10,
      });
      expect(saleRes.body.details[1]).toMatchObject({
        quantity: 10,
        displayQuantity: 1,
        displaySalePrice: 20000,
        unitName: 'Vỉ',
        conversionRate: 10,
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
        isLowStock: false,
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

      await request(app)
        .patch(`/v1/stores/${store.id}/medicines/${medicineRes.body.id}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          baseUnitName: 'Gói',
          units: [{ name: 'Gói', conversionRate: 1, isBaseUnit: true }],
        })
        .expect(httpStatus.CONFLICT);

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
    },
  );

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

  test('should manage store-scoped product categories with pagination and role checks', async () => {
    await insertUsers([userOne, userTwo]);
    const [managedStore, otherStore] = await Promise.all([
      prisma.store.create({ data: { name: 'Category store' } }),
      prisma.store.create({ data: { name: 'Other category store' } }),
    ]);
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: managedStore.id, role: 'owner' },
        { userId: userTwo.id, storeId: managedStore.id, role: 'staff' },
      ],
    });
    const ownerToken = accessToken(userOne.id);
    const staffToken = accessToken(userTwo.id);

    const categoryRes = await request(app)
      .post(`/v1/stores/${managedStore.id}/product-categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Dược phẩm', description: 'Nhóm sản phẩm chính' })
      .expect(httpStatus.CREATED);

    await request(app)
      .post(`/v1/stores/${managedStore.id}/product-categories`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'dược PHẨM' })
      .expect(httpStatus.CONFLICT);

    await request(app)
      .post(`/v1/stores/${managedStore.id}/product-categories`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ name: 'Không được tạo' })
      .expect(httpStatus.FORBIDDEN);

    const listRes = await request(app)
      .get(`/v1/stores/${managedStore.id}/product-categories`)
      .query({ search: 'dược', page: 1, limit: 1 })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);
    expect(listRes.body).toMatchObject({ page: 1, limit: 1, totalPages: 1, totalResults: 1 });
    expect(listRes.body.results[0]).toMatchObject({
      id: categoryRes.body.id,
      name: 'Dược phẩm',
      productCount: 0,
      isActive: true,
    });

    const updatedRes = await request(app)
      .patch(`/v1/stores/${managedStore.id}/product-categories/${categoryRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Dược phẩm chính', isActive: false })
      .expect(httpStatus.OK);
    expect(updatedRes.body).toMatchObject({ name: 'Dược phẩm chính', isActive: false });

    await request(app)
      .get(`/v1/stores/${otherStore.id}/product-categories`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);
  });

  test('should generate the next store-scoped product code for managers', async () => {
    await insertUsers([userOne, userTwo]);
    const [managedStore, otherStore] = await Promise.all([
      prisma.store.create({ data: { name: 'Managed code store' } }),
      prisma.store.create({ data: { name: 'Other code store' } }),
    ]);
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: managedStore.id, role: 'owner' },
        { userId: userTwo.id, storeId: managedStore.id, role: 'staff' },
      ],
    });
    const [managedCategory, otherCategory, managedProduct, otherProduct] = await Promise.all([
      prisma.productCategory.create({ data: { storeId: managedStore.id, name: 'Hàng hóa' } }),
      prisma.productCategory.create({ data: { storeId: otherStore.id, name: 'Hàng hóa' } }),
      prisma.medicine.create({ data: { name: 'Sản phẩm đang có', baseUnitName: 'Cái' } }),
      prisma.medicine.create({ data: { name: 'Sản phẩm quầy khác', baseUnitName: 'Cái' } }),
    ]);
    await prisma.storeMedicine.createMany({
      data: [
        {
          storeId: managedStore.id,
          medicineId: managedProduct.id,
          categoryId: managedCategory.id,
          code: 'SP000337',
        },
        {
          storeId: otherStore.id,
          medicineId: otherProduct.id,
          categoryId: otherCategory.id,
          code: 'SP999999',
        },
      ],
    });

    const ownerToken = accessToken(userOne.id);
    const staffToken = accessToken(userTwo.id);
    const response = await request(app)
      .get(`/v1/stores/${managedStore.id}/medicines/next-code`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(httpStatus.OK);

    expect(response.body).toEqual({ code: 'SP000338' });

    await request(app)
      .get(`/v1/stores/${managedStore.id}/medicines/next-code`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);
    await request(app)
      .get(`/v1/stores/${otherStore.id}/medicines/next-code`)
      .set('Authorization', `Bearer ${ownerToken}`)
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
        unitName: 'Hộp',
        registrationNumber: `${search}-GPNK`,
        barcode: sharedBarcode,
        secondaryBarcode: faker.random.alphaNumeric(12),
        manufacturer: 'Nhà sản xuất B',
        countryOfOrigin: 'Đức',
        importerName: 'Công ty nhập khẩu B',
        activeIngredient: 'Hoạt chất B',
        specification: 'Hộp 10 vỉ x 10 viên',
        usageInstructions: 'Dùng theo chỉ dẫn',
        categoryName: 'Dược phẩm',
        positionName: 'Kệ B',
        supplierName: 'Nhà cung cấp B',
        inputPrice: 1200,
        referencePrice: 2000,
        wholesalePrice: 1800,
        doctorDiscountPercent: 5,
        employeeDiscountPercent: 2,
        minInventory: 7,
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

    const [firstCategory, secondCategory, updatedCategory] = await Promise.all([
      prisma.productCategory.create({ data: { storeId: firstStore.id, name: 'Dược phẩm' } }),
      prisma.productCategory.create({ data: { storeId: secondStore.id, name: 'Dược phẩm' } }),
      prisma.productCategory.create({ data: { storeId: firstStore.id, name: 'Thuốc kê đơn' } }),
    ]);

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
        unitName: 'Hộp',
        registrationNumber: `${search}-GPNK`,
        activeIngredient: 'Hoạt chất B',
        countryOfOrigin: 'Đức',
        importerName: 'Công ty nhập khẩu B',
        usageInstructions: 'Dùng theo chỉ dẫn',
        categoryName: 'Dược phẩm',
        positionName: 'Kệ B',
        supplierName: 'Nhà cung cấp B',
        inputPrice: 1200,
        referencePrice: 2000,
        wholesalePrice: 1800,
        doctorDiscountPercent: 5,
        employeeDiscountPercent: 2,
        minInventory: 7,
        isAddedToStore: false,
      }),
    ]);

    await request(app)
      .get(`/v1/stores/${unrelatedStore.id}/reference-products`)
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.FORBIDDEN);

    const createPayload = {
      categoryId: firstCategory.id,
      code: referenceProducts[1].code.toUpperCase(),
      positionName: 'Kệ B2',
      referenceProductId: referenceProducts[1].id,
      name: 'Tên giả từ client',
      baseUnitName: 'Viên',
      barcode: faker.random.alphaNumeric(12),
      manufacturer: 'Nhà sản xuất giả từ client',
      sellingPrice: 3000,
      isActive: true,
    };
    const firstMedicineRes = await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send(createPayload)
      .expect(httpStatus.CREATED);
    expect(firstMedicineRes.body).toMatchObject({
      name: referenceProducts[1].name,
      baseUnitName: 'Hộp',
      barcode: referenceProducts[1].barcode,
      secondaryBarcode: referenceProducts[1].secondaryBarcode,
      registrationNumber: `${search}-GPNK`,
      manufacturer: referenceProducts[1].manufacturer,
      countryOfOrigin: 'Đức',
      importerName: 'Công ty nhập khẩu B',
      activeIngredient: 'Hoạt chất B',
      category: 'Dược phẩm',
      specification: 'Hộp 10 vỉ x 10 viên',
      usageInstructions: 'Dùng theo chỉ dẫn',
      code: referenceProducts[1].code.toUpperCase(),
      positionName: 'Kệ B2',
    });

    const secondMedicineRes = await request(app)
      .post(`/v1/stores/${secondStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...createPayload, categoryId: secondCategory.id, sellingPrice: 3500 })
      .expect(httpStatus.CREATED);

    expect(secondMedicineRes.body).toMatchObject({
      id: firstMedicineRes.body.id,
      referenceProductId: referenceProducts[1].id,
      categoryId: secondCategory.id,
      sellingPrice: 3500,
    });
    expect(secondMedicineRes.body.storeMedicineId).not.toBe(firstMedicineRes.body.storeMedicineId);
    expect(await prisma.medicine.count({ where: { referenceProductId: referenceProducts[1].id } })).toBe(1);
    expect(await prisma.storeMedicine.count({ where: { medicineId: firstMedicineRes.body.id } })).toBe(2);

    const duplicateBarcodeRes = await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        ...createPayload,
        code: referenceProducts[2].code,
        referenceProductId: referenceProducts[2].id,
      })
      .expect(httpStatus.CREATED);
    expect(duplicateBarcodeRes.body).toMatchObject({
      referenceProductId: referenceProducts[2].id,
      name: referenceProducts[2].name,
      barcode: fallbackBarcode,
    });

    await request(app)
      .patch(`/v1/stores/${firstStore.id}/medicines/${duplicateBarcodeRes.body.id}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ code: referenceProducts[1].code })
      .expect(httpStatus.CONFLICT);

    await request(app)
      .post(`/v1/stores/${firstStore.id}/medicines`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ ...createPayload, code: `${search}-DUPLICATE-ASSIGNMENT` })
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
      .send({
        categoryId: updatedCategory.id,
        code: `${search}-STORE-CODE`,
        positionName: 'Kệ C3',
        sellingPrice: 4200,
        isActive: false,
      })
      .expect(httpStatus.OK);

    expect(updatedRes.body).toMatchObject({
      categoryId: updatedCategory.id,
      category: 'Thuốc kê đơn',
      code: `${search}-STORE-CODE`.toUpperCase(),
      positionName: 'Kệ C3',
      sellingPrice: 4200,
      isActive: false,
    });
    const secondAssignment = await prisma.storeMedicine.findUniqueOrThrow({
      where: {
        storeId_medicineId: {
          storeId: secondStore.id,
          medicineId: firstMedicineRes.body.id,
        },
      },
    });
    expect(Number(secondAssignment.sellingPrice)).toBe(3500);
    expect(secondAssignment.categoryId).toBe(secondCategory.id);
    expect(secondAssignment.code).toBe(referenceProducts[1].code.toUpperCase());
    expect(secondAssignment.positionName).toBe('Kệ B2');
    expect(secondAssignment.isActive).toBe(true);

    const updatedLibraryRes = await request(app)
      .get(`/v1/stores/${firstStore.id}/reference-products`)
      .query({ search: referenceProducts[1].code })
      .set('Authorization', `Bearer ${staffToken}`)
      .expect(httpStatus.OK);
    expect(updatedLibraryRes.body.results[0]).toMatchObject({ isAddedToStore: true });
  });

  test('should only allow tablet-to-blister conversion and protect shared units', async () => {
    await insertUsers([userOne]);
    const [firstStore, secondStore] = await Promise.all([
      prisma.store.create({ data: { name: 'Unit store A' } }),
      prisma.store.create({ data: { name: 'Unit store B' } }),
    ]);
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: firstStore.id, role: 'owner' },
        { userId: userOne.id, storeId: secondStore.id, role: 'owner' },
      ],
    });
    const token = accessToken(userOne.id);
    const [firstCategory, secondCategory] = await Promise.all([
      prisma.productCategory.create({ data: { storeId: firstStore.id, name: 'Dược phẩm' } }),
      prisma.productCategory.create({ data: { storeId: secondStore.id, name: 'Dược phẩm' } }),
    ]);
    const createIn = (storeId: string, categoryId: string, body: Record<string, unknown>) =>
      request(app)
        .post(`/v1/stores/${storeId}/medicines`)
        .set('Authorization', `Bearer ${token}`)
        .send({ categoryId, name: faker.commerce.productName(), sellingPrice: 1000, ...body });
    const tabletUnits = (tabletsPerBlister: number) => [
      { name: 'Viên', conversionRate: 1, isBaseUnit: true },
      { name: 'Vỉ', conversionRate: tabletsPerBlister, isBaseUnit: false },
    ];

    await createIn(firstStore.id, firstCategory.id, { baseUnitName: 'Viên', units: tabletUnits(10) }).expect(
      httpStatus.CREATED,
    );
    await createIn(firstStore.id, firstCategory.id, {
      baseUnitName: 'Viên',
      units: [...tabletUnits(10), { name: 'Hộp', conversionRate: 100, isBaseUnit: false }],
    }).expect(httpStatus.BAD_REQUEST);
    await createIn(firstStore.id, firstCategory.id, {
      baseUnitName: 'Viên',
      units: [
        { name: 'Viên', conversionRate: 1, isBaseUnit: true },
        { name: 'Hộp', conversionRate: 100, isBaseUnit: false },
      ],
    }).expect(httpStatus.BAD_REQUEST);
    await createIn(firstStore.id, firstCategory.id, {
      baseUnitName: 'Gói',
      units: [
        { name: 'Gói', conversionRate: 1, isBaseUnit: true },
        { name: 'Vỉ', conversionRate: 10, isBaseUnit: false },
      ],
    }).expect(httpStatus.BAD_REQUEST);
    await createIn(firstStore.id, firstCategory.id, { baseUnitName: 'Viên', units: tabletUnits(9.99) }).expect(
      httpStatus.BAD_REQUEST,
    );

    const referenceProduct = await prisma.referenceProduct.create({
      data: {
        id: faker.datatype.uuid(),
        code: `REF-${faker.random.alphaNumeric(8)}`,
        name: 'Thuốc viên dùng chung',
        unitName: 'Viên',
      },
    });
    const sharedRes = await createIn(firstStore.id, firstCategory.id, {
      referenceProductId: referenceProduct.id,
      baseUnitName: 'Viên',
      units: tabletUnits(10),
    }).expect(httpStatus.CREATED);
    await createIn(secondStore.id, secondCategory.id, {
      referenceProductId: referenceProduct.id,
      baseUnitName: 'Viên',
      units: tabletUnits(10),
    }).expect(httpStatus.CREATED);

    const patchShared = (body: Record<string, unknown>) =>
      request(app)
        .patch(`/v1/stores/${firstStore.id}/medicines/${sharedRes.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    await patchShared({ units: tabletUnits(12) }).expect(httpStatus.CONFLICT);
    await patchShared({ units: tabletUnits(10), sellingPrice: 1200 }).expect(httpStatus.OK);
    const sharedUnits = await prisma.medicineUnit.findMany({ where: { medicineId: sharedRes.body.id } });
    expect(sharedUnits.map(({ name, conversionRate }) => [name, Number(conversionRate)]).sort()).toEqual([
      ['Viên', 1],
      ['Vỉ', 10],
    ]);
  });

  test('should apply a new selling price from an import receipt only when it is completed', async () => {
    await insertUsers([userOne]);
    const store = await prisma.store.create({ data: { name: 'Import price store' } });
    await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'manager' } });
    const token = accessToken(userOne.id);
    const category = await prisma.productCategory.create({ data: { storeId: store.id, name: 'Dược phẩm' } });
    const medicineRes = await request(app)
      .post(`/v1/stores/${store.id}/medicines`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        categoryId: category.id,
        name: 'Thuốc đổi giá',
        baseUnitName: 'Viên',
        sellingPrice: 2000,
        units: [
          { name: 'Viên', conversionRate: 1, isBaseUnit: true },
          { name: 'Vỉ', conversionRate: 10, isBaseUnit: false },
        ],
      })
      .expect(httpStatus.CREATED);
    const medicineId = medicineRes.body.id;
    const blisterUnitId = medicineRes.body.units.find((unit: { name: string }) => unit.name === 'Vỉ').id;
    const line = (batchNumber: string, extra: Record<string, unknown> = {}) => ({
      medicineId,
      unitId: blisterUnitId,
      batchNumber,
      quantity: 5,
      importPrice: 15000,
      expiryDate: futureDate(365),
      ...extra,
    });
    const createImport = (items: Record<string, unknown>[]) =>
      request(app).post(`/v1/stores/${store.id}/imports`).set('Authorization', `Bearer ${token}`).send({ items });
    const currentPrice = async () =>
      Number(
        (
          await prisma.storeMedicine.findUniqueOrThrow({
            where: { storeId_medicineId: { storeId: store.id, medicineId } },
          })
        ).sellingPrice,
      );

    await createImport([line('LO-A', { sellingPrice: 2500 }), line('LO-B', { sellingPrice: 2600 })]).expect(
      httpStatus.BAD_REQUEST,
    );
    await createImport([line('LO-A', { quantity: 1.5 })]).expect(httpStatus.BAD_REQUEST);
    await createImport([line('LO-A', { sellingPrice: 2500.5 })]).expect(httpStatus.BAD_REQUEST);

    const cancelledDraft = await createImport([line('LO-C', { sellingPrice: 9999 })]).expect(httpStatus.CREATED);
    await request(app)
      .post(`/v1/stores/${store.id}/imports/${cancelledDraft.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.OK);

    const draft = await createImport([line('LO-A', { sellingPrice: 2500 }), line('LO-B', { sellingPrice: 2500 })]).expect(
      httpStatus.CREATED,
    );
    expect(draft.body.details[0].newSellingPrice).toBe(2500);
    expect(await currentPrice()).toBe(2000);

    const detailRes = await request(app)
      .get(`/v1/stores/${store.id}/imports/${draft.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.OK);
    expect(detailRes.body.details[0]).toMatchObject({ newSellingPrice: 2500, currentSellingPrice: 2000 });

    await request(app)
      .post(`/v1/stores/${store.id}/imports/${draft.body.id}/complete`)
      .set('Authorization', `Bearer ${token}`)
      .expect(httpStatus.OK);
    expect(await currentPrice()).toBe(2500);
    const priceAudits = await prisma.auditLog.findMany({ where: { storeId: store.id, action: 'medicine.price_change' } });
    expect(priceAudits).toHaveLength(1);
    expect(priceAudits[0].metadata).toMatchObject({ from: 2000, to: 2500, importReceiptId: draft.body.id });
  });

  test('should create a new product together with its first completed import', async () => {
    await insertUsers([userOne, userTwo]);
    const store = await prisma.store.create({ data: { name: 'New product import store' } });
    await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'manager' } });
    await prisma.user.update({ where: { id: userTwo.id }, data: { isSystemAdmin: true } });
    const managerToken = accessToken(userOne.id);
    const category = await prisma.productCategory.create({ data: { storeId: store.id, name: 'Dược phẩm' } });
    const newProduct = (name: string, expiryDate: string) => ({
      categoryId: category.id,
      name,
      baseUnitName: 'Viên',
      sellingPrice: 2500,
      initialImport: { quantity: 120, importPrice: 1500, batchNumber: 'LO-NEW-01', expiryDate },
    });

    const res = await request(app)
      .post(`/v1/stores/${store.id}/medicines`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send(newProduct('Vitamin C 500mg', futureDate(365)))
      .expect(httpStatus.CREATED);

    expect(res.body).toMatchObject({ name: 'Vitamin C 500mg', sellingPrice: 2500, totalStock: 120, availableStock: 120 });

    const importsRes = await request(app)
      .get(`/v1/stores/${store.id}/imports`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(httpStatus.OK);
    expect(importsRes.body.results).toHaveLength(1);
    expect(importsRes.body.results[0]).toMatchObject({ status: 'completed', totalAmount: 180000 });
    expect(importsRes.body.results[0].details[0]).toMatchObject({
      medicineId: res.body.id,
      batchNumber: 'LO-NEW-01',
      quantity: 120,
      importPrice: 1500,
      unitName: 'Viên',
    });

    const batch = await prisma.stockBatch.findFirstOrThrow({ where: { storeId: store.id, medicineId: res.body.id } });
    expect(Number(batch.quantityRemaining)).toBe(120);
    expect(Number(batch.importPrice)).toBe(1500);
    const movement = await prisma.inventoryMovement.findFirstOrThrow({ where: { stockBatchId: batch.id } });
    expect(movement).toMatchObject({ type: 'import', referenceType: 'import_receipt', createdBy: userOne.id });
    expect(Number(movement.quantityDelta)).toBe(120);
    const auditActions = await prisma.auditLog.findMany({ where: { storeId: store.id }, select: { action: true } });
    expect(auditActions.map(({ action }) => action).sort()).toEqual(['import.complete', 'medicine.create']);

    await request(app)
      .post(`/v1/stores/${store.id}/medicines`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send(newProduct('Expired product', moment().format('YYYY-MM-DD')))
      .expect(httpStatus.BAD_REQUEST);

    await request(app)
      .post(`/v1/stores/${store.id}/medicines`)
      .set('Authorization', `Bearer ${accessToken(userTwo.id)}`)
      .send(newProduct('System admin product', futureDate(365)))
      .expect(httpStatus.FORBIDDEN);

    expect(await prisma.storeMedicine.count({ where: { storeId: store.id } })).toBe(1);
    expect(await prisma.importReceipt.count({ where: { storeId: store.id } })).toBe(1);
  });

  test('should list in-stock products before sold-out ones when requested', async () => {
    await insertUsers([userOne]);
    const store = await prisma.store.create({ data: { name: 'Stock order store' } });
    await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'manager' } });
    const token = accessToken(userOne.id);
    const category = await prisma.productCategory.create({ data: { storeId: store.id, name: 'Dược phẩm' } });
    const create = (name: string, stocked: boolean) =>
      request(app)
        .post(`/v1/stores/${store.id}/medicines`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: category.id,
          name,
          baseUnitName: 'Viên',
          sellingPrice: 1000,
          ...(stocked
            ? { initialImport: { quantity: 20, importPrice: 500, batchNumber: 'LO-1', expiryDate: futureDate(365) } }
            : {}),
        })
        .expect(httpStatus.CREATED);
    await create('Aaa hết hàng', false);
    await create('Bbb còn hàng', true);
    await create('Ccc còn hàng', true);

    const list = (query: Record<string, unknown>) =>
      request(app)
        .get(`/v1/stores/${store.id}/medicines`)
        .query(query)
        .set('Authorization', `Bearer ${token}`)
        .expect(httpStatus.OK);
    const names = (res: { body: { results: Array<{ name: string }> } }) => res.body.results.map(({ name }) => name);

    expect(names(await list({}))).toEqual(['Aaa hết hàng', 'Bbb còn hàng', 'Ccc còn hàng']);
    expect(names(await list({ inStockFirst: true }))).toEqual(['Bbb còn hàng', 'Ccc còn hàng', 'Aaa hết hàng']);
    expect(names(await list({ inStockFirst: true, limit: 1 }))).toEqual(['Bbb còn hàng']);
  });

  test('should return sold items partially then fully, restocking batches and netting revenue', async () => {
    await insertUsers([userOne, userTwo]);
    const store = await prisma.store.create({ data: { name: 'Return store' } });
    const otherStore = await prisma.store.create({ data: { name: 'Other return store' } });
    await prisma.userStoreRole.createMany({
      data: [
        { userId: userOne.id, storeId: store.id, role: 'manager' },
        { userId: userTwo.id, storeId: store.id, role: 'staff' },
        { userId: userTwo.id, storeId: otherStore.id, role: 'manager' },
      ],
    });
    const managerToken = accessToken(userOne.id);
    const staffToken = accessToken(userTwo.id);
    const category = await prisma.productCategory.create({ data: { storeId: store.id, name: 'Dược phẩm' } });
    const createMedicine = async (name: string, sellingPrice: number, quantity: number) =>
      (
        await request(app)
          .post(`/v1/stores/${store.id}/medicines`)
          .set('Authorization', `Bearer ${managerToken}`)
          .send({
            categoryId: category.id,
            name,
            baseUnitName: 'Viên',
            sellingPrice,
            initialImport: { quantity, importPrice: 500, batchNumber: 'LO-1', expiryDate: futureDate(365) },
          })
          .expect(httpStatus.CREATED)
      ).body;
    const medicineA = await createMedicine('Thuốc A', 2000, 100);
    const medicineB = await createMedicine('Thuốc B', 3000, 50);

    // gross 26000, discount 2600 -> paid 23400, so every line is refunded at 90%
    const saleRes = await request(app)
      .post(`/v1/stores/${store.id}/sales`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        paymentMethod: 'cash',
        discountAmount: 2600,
        items: [
          { medicineId: medicineA.id, quantity: 10 },
          { medicineId: medicineB.id, quantity: 2 },
        ],
      })
      .expect(httpStatus.CREATED);
    expect(saleRes.body.totalAmount).toBe(23400);
    const detailOf = (medicineId: string) =>
      saleRes.body.details.find((detail: { medicineId: string }) => detail.medicineId === medicineId);
    const returnUrl = `/v1/stores/${store.id}/sales/${saleRes.body.id}/returns`;
    const stockOf = async (medicineId: string) =>
      Number((await prisma.stockBatch.findFirstOrThrow({ where: { storeId: store.id, medicineId } })).quantityRemaining);

    await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 1 }] })
      .expect(httpStatus.FORBIDDEN);
    await request(app)
      .post(`/v1/stores/${otherStore.id}/sales/${saleRes.body.id}/returns`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 1 }] })
      .expect(httpStatus.NOT_FOUND);
    await request(app)
      .post(`/v1/stores/${otherStore.id}/sales/${saleRes.body.id}/returns`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 1 }] })
      .expect(httpStatus.FORBIDDEN);
    expect(await stockOf(medicineA.id)).toBe(90);

    const firstReturn = await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ note: 'Khách đổi ý', items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 4 }] })
      .expect(httpStatus.CREATED);
    expect(firstReturn.body).toMatchObject({ status: 'completed', refundedAmount: 7200 });
    expect(firstReturn.body.returns).toHaveLength(1);
    expect(firstReturn.body.returns[0]).toMatchObject({ refundAmount: 7200, note: 'Khách đổi ý' });
    expect(firstReturn.body.details.find((detail: { id: string }) => detail.id === detailOf(medicineA.id).id)).toMatchObject(
      {
        returnedQuantity: 4,
      },
    );
    expect(await stockOf(medicineA.id)).toBe(94);
    const movement = await prisma.inventoryMovement.findFirstOrThrow({
      where: { storeId: store.id, type: 'return', medicineId: medicineA.id },
    });
    expect(movement).toMatchObject({ referenceType: 'sale_return', createdBy: userOne.id });
    expect(Number(movement.quantityDelta)).toBe(4);

    await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 7 }] })
      .expect(httpStatus.CONFLICT);
    await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        items: [
          { saleDetailId: detailOf(medicineA.id).id, quantity: 1 },
          { saleDetailId: detailOf(medicineA.id).id, quantity: 1 },
        ],
      })
      .expect(httpStatus.BAD_REQUEST);
    expect(await stockOf(medicineA.id)).toBe(94);

    const secondReturn = await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        items: [
          { saleDetailId: detailOf(medicineA.id).id, quantity: 6 },
          { saleDetailId: detailOf(medicineB.id).id, quantity: 2 },
        ],
      })
      .expect(httpStatus.CREATED);
    expect(secondReturn.body).toMatchObject({ status: 'refunded', refundedAmount: 23400 });
    expect(await stockOf(medicineA.id)).toBe(100);
    expect(await stockOf(medicineB.id)).toBe(50);

    await request(app)
      .post(returnUrl)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ items: [{ saleDetailId: detailOf(medicineA.id).id, quantity: 1 }] })
      .expect(httpStatus.CONFLICT);

    const dashboard = await request(app)
      .get(`/v1/stores/${store.id}/dashboard`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(httpStatus.OK);
    expect(dashboard.body.today).toMatchObject({ revenue: 0, cost: 0, grossProfit: 0, orders: 0 });
    const report = await request(app)
      .get(`/v1/stores/${store.id}/reports/profit`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(httpStatus.OK);
    expect(report.body.totals).toMatchObject({ revenue: 0, cost: 0, grossProfit: 0, orders: 0 });

    const audits = await prisma.auditLog.findMany({ where: { storeId: store.id, action: 'sale.return' } });
    expect(audits).toHaveLength(2);
  });

  test('should refund whole đồng and reconcile rounding across partial returns', async () => {
    await insertUsers([userOne]);
    const store = await prisma.store.create({ data: { name: 'Rounding store' } });
    await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'manager' } });
    const token = accessToken(userOne.id);
    const category = await prisma.productCategory.create({ data: { storeId: store.id, name: 'Dược phẩm' } });
    const medicine = (
      await request(app)
        .post(`/v1/stores/${store.id}/medicines`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          categoryId: category.id,
          name: 'Thuốc làm tròn',
          baseUnitName: 'Viên',
          sellingPrice: 2500,
          initialImport: { quantity: 100, importPrice: 500, batchNumber: 'LO-1', expiryDate: futureDate(365) },
        })
        .expect(httpStatus.CREATED)
    ).body;

    // gross 12500, discount 1001 -> paid 11499 (ratio 0.91992), so single-unit refunds are not whole đồng
    const sale = (
      await request(app)
        .post(`/v1/stores/${store.id}/sales`)
        .set('Authorization', `Bearer ${token}`)
        .send({ paymentMethod: 'cash', discountAmount: 1001, items: [{ medicineId: medicine.id, quantity: 5 }] })
        .expect(httpStatus.CREATED)
    ).body;
    expect(sale.totalAmount).toBe(11499);

    const returnItems = (quantity: number) =>
      request(app)
        .post(`/v1/stores/${store.id}/sales/${sale.id}/returns`)
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ saleDetailId: sale.details[0].id, quantity }] })
        .expect(httpStatus.CREATED);

    const first = await returnItems(1);
    const second = await returnItems(2);
    const last = await returnItems(2);

    expect(first.body.returns[0].refundAmount).toBe(2300);
    expect(second.body.returns[0].refundAmount).toBe(4599);
    expect(last.body.returns[0].refundAmount).toBe(4600);
    expect(last.body).toMatchObject({ status: 'refunded', refundedAmount: 11499 });
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
