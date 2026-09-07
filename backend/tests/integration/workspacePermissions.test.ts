import request from 'supertest';
import moment from 'moment';
import app from '../../src/app.js';
import { prisma } from '../../src/config/database.js';
import { tokenTypes } from '../../src/config/tokens.js';
import * as tokenService from '../../src/services/token.service.js';
import setupTestDB from '../utils/setupTestDB.js';
import { admin, userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';

setupTestDB();
const authorization = (id: string) =>
  `Bearer ${tokenService.generateToken(id, moment().add(5, 'minutes'), tokenTypes.ACCESS)}`;

test('owner edits only the owned active store; only system admin changes store status', async () => {
  await insertUsers([userOne, userTwo, { ...admin, isSystemAdmin: true }]);
  const owned = await prisma.store.create({ data: { name: 'Owned' } });
  const other = await prisma.store.create({ data: { name: 'Other' } });
  await prisma.userStoreRole.createMany({
    data: [
      { userId: userOne.id, storeId: owned.id, role: 'owner' },
      { userId: userOne.id, storeId: other.id, role: 'staff' },
      { userId: userTwo.id, storeId: owned.id, role: 'manager' },
    ],
  });
  const path = `/v1/admin/stores/${owned.id}`;
  await request(app)
    .patch(path)
    .set('Authorization', authorization(userOne.id))
    .send({ name: 'Updated', address: 'New address', phone: '0900000000' })
    .expect(200);
  expect(await prisma.store.findUnique({ where: { id: owned.id } })).toMatchObject({ name: 'Updated', isActive: true });
  expect(await prisma.auditLog.count({ where: { storeId: owned.id, action: 'store.update' } })).toBe(1);
  await request(app)
    .patch(`/v1/admin/stores/${other.id}`)
    .set('Authorization', authorization(userOne.id))
    .send({ name: 'Forbidden' })
    .expect(403);
  await request(app).patch(path).set('Authorization', authorization(userTwo.id)).send({ name: 'Forbidden' }).expect(403);
  await request(app).patch(path).set('Authorization', authorization(userOne.id)).send({ isActive: false }).expect(403);
  await prisma.userStoreRole.update({
    where: { userId_storeId: { userId: userOne.id, storeId: owned.id } },
    data: { isActive: false },
  });
  await request(app).patch(path).set('Authorization', authorization(userOne.id)).send({ name: 'Forbidden' }).expect(403);
  await request(app).patch(path).set('Authorization', authorization(admin.id)).send({ isActive: false }).expect(200);
  expect(await prisma.store.findUnique({ where: { id: other.id } })).toMatchObject({ name: 'Other' });
  expect(await prisma.store.findUnique({ where: { id: owned.id } })).toMatchObject({ name: 'Updated', isActive: false });
});

test('system admin reads imports and sales but cannot create, complete or cancel operations', async () => {
  await insertUsers([userOne, { ...admin, isSystemAdmin: true }]);
  const store = await prisma.store.create({ data: { name: 'Read only' } });
  // Even an explicit owner membership must not grant operational writes to System Admin.
  await prisma.userStoreRole.create({ data: { userId: admin.id, storeId: store.id, role: 'owner' } });
  const receipt = await prisma.importReceipt.create({ data: { storeId: store.id, createdBy: userOne.id } });
  const base = `/v1/stores/${store.id}`;
  for (const path of ['/imports', `/imports/${receipt.id}`, '/sales']) {
    await request(app)
      .get(base + path)
      .set('Authorization', authorization(admin.id))
      .expect(200);
  }
  await request(app)
    .post(`${base}/imports`)
    .set('Authorization', authorization(admin.id))
    .send({
      items: [{ medicineId: userOne.id, batchNumber: 'TEST', quantity: 1, importPrice: 1, expiryDate: '2099-01-01' }],
    })
    .expect(403);
  for (const action of ['complete', 'cancel']) {
    await request(app)
      .post(`${base}/imports/${receipt.id}/${action}`)
      .set('Authorization', authorization(admin.id))
      .expect(403);
  }
  await request(app)
    .post(`${base}/sales`)
    .set('Authorization', authorization(admin.id))
    .send({
      paymentMethod: 'cash',
      items: [{ medicineId: userOne.id, quantity: 1 }],
    })
    .expect(403);
  expect(await prisma.importReceipt.count()).toBe(1);
  expect(await prisma.importReceipt.findUnique({ where: { id: receipt.id } })).toMatchObject({ status: 'draft' });
  expect(await prisma.sale.count()).toBe(0);
  expect(await prisma.stockBatch.count()).toBe(0);
  expect(await prisma.inventoryMovement.count()).toBe(0);
});

test('staff reads suppliers in its store but cannot edit or read another store', async () => {
  await insertUsers([userOne]);
  const store = await prisma.store.create({ data: { name: 'Staff store' } });
  const other = await prisma.store.create({ data: { name: 'Other' } });
  await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'staff' } });
  const supplier = await prisma.supplier.create({ data: { storeId: store.id, name: 'Supplier' } });
  const response = await request(app)
    .get(`/v1/stores/${store.id}/suppliers`)
    .set('Authorization', authorization(userOne.id))
    .expect(200);
  expect(response.body.results).toEqual([expect.objectContaining({ id: supplier.id })]);
  await request(app).get(`/v1/stores/${other.id}/suppliers`).set('Authorization', authorization(userOne.id)).expect(403);
  await request(app)
    .post(`/v1/stores/${store.id}/suppliers`)
    .set('Authorization', authorization(userOne.id))
    .send({ name: 'Forbidden' })
    .expect(403);
  await request(app)
    .patch(`/v1/stores/${store.id}/suppliers/${supplier.id}`)
    .set('Authorization', authorization(userOne.id))
    .send({ name: 'Forbidden' })
    .expect(403);
  expect(await prisma.supplier.findUnique({ where: { id: supplier.id } })).toMatchObject({ name: 'Supplier' });
});

test('system admin manages unassigned accounts globally without changing store memberships', async () => {
  await insertUsers([userOne, userTwo, { ...admin, isSystemAdmin: true }]);
  const store = await prisma.store.create({ data: { name: 'Owned' } });
  await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'owner' } });
  const response = await request(app).get('/v1/admin/users').set('Authorization', authorization(admin.id)).expect(200);
  expect(response.body.results).toEqual(
    expect.arrayContaining([expect.objectContaining({ id: userTwo.id, storeRoles: [] })]),
  );
  const scoped = await request(app)
    .get('/v1/admin/users')
    .query({ storeId: store.id })
    .set('Authorization', authorization(admin.id))
    .expect(200);
  expect(scoped.body.results.map((user: { id: string }) => user.id)).not.toContain(userTwo.id);
  const path = `/v1/admin/users/${userTwo.id}`;
  await request(app).patch(path).set('Authorization', authorization(userOne.id)).send({ isActive: false }).expect(403);
  await request(app).patch(path).set('Authorization', authorization(admin.id)).send({ storeRole: 'owner' }).expect(400);
  const updated = await request(app)
    .patch(path)
    .set('Authorization', authorization(admin.id))
    .send({ name: 'Updated globally', isActive: false })
    .expect(200);
  expect(updated.body).not.toHaveProperty('password');
  expect(await prisma.user.findUnique({ where: { id: userTwo.id } })).toMatchObject({
    name: 'Updated globally',
    isActive: false,
  });
  expect(await prisma.userStoreRole.count({ where: { userId: userTwo.id } })).toBe(0);
  await request(app).patch(path).set('Authorization', authorization(admin.id)).send({ isActive: true }).expect(200);
  expect(await prisma.user.findUnique({ where: { id: userTwo.id } })).toMatchObject({ isActive: true });
});
