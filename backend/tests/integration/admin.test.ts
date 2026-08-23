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
import { admin, userOne, userTwo, insertUsers } from '../fixtures/user.fixture.js';

setupTestDB();

const createAccessToken = (userId: string) =>
  tokenService.generateToken(userId, moment().add(config.jwt.accessExpirationMinutes, 'minutes'), tokenTypes.ACCESS);

describe('Admin routes', () => {
  describe('GET /v1/admin/me', () => {
    test('should return 403 if staff tries to access admin panel', async () => {
      await insertUsers([userOne]);
      const store = await prisma.store.create({ data: { name: faker.company.companyName() } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'staff' } });

      await request(app)
        .get('/v1/admin/me')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should return 403 if staff tries to access any admin resource', async () => {
      await insertUsers([userOne]);
      const store = await prisma.store.create({ data: { name: faker.company.companyName() } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'staff' } });

      await request(app)
        .get('/v1/admin/medicines')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .expect(httpStatus.FORBIDDEN);
    });

    test('should reserve the global medicine catalog for system admins', async () => {
      await insertUsers([userOne]);
      const store = await prisma.store.create({ data: { name: faker.company.companyName() } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'owner' } });

      await request(app)
        .get('/v1/admin/medicines')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /v1/admin/stores', () => {
    test('should allow system admin to create a store with the first owner', async () => {
      await insertUsers([{ ...admin, isSystemAdmin: true }]);

      const ownerEmail = faker.internet.email().toLowerCase();
      const res = await request(app)
        .post('/v1/admin/stores')
        .set('Authorization', `Bearer ${createAccessToken(admin.id)}`)
        .send({
          name: 'Nha thuoc trung tam',
          address: '1 Nguyen Trai',
          phone: '0900000000',
          owner: {
            name: 'Owner One',
            email: ownerEmail,
            phone: '0911111111',
            password: 'password1',
          },
        })
        .expect(httpStatus.CREATED);

      expect(res.body.store).toMatchObject({ name: 'Nha thuoc trung tam', isActive: true });
      const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, include: { storeRoles: true } });
      expect(owner?.storeRoles).toEqual([
        expect.objectContaining({
          storeId: res.body.store.id,
          role: 'owner',
        }),
      ]);
      expect(await prisma.productCategory.count({ where: { storeId: res.body.store.id } })).toBe(5);
    });

    test('should return 403 if non system admin creates a store', async () => {
      await insertUsers([userOne]);
      const store = await prisma.store.create({ data: { name: faker.company.companyName() } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'owner' } });

      await request(app)
        .post('/v1/admin/stores')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({ name: 'Unauthorized store' })
        .expect(httpStatus.FORBIDDEN);
    });
  });

  describe('POST /v1/admin/users', () => {
    test('should prevent owner from creating users outside owned stores', async () => {
      await insertUsers([userOne]);
      const ownedStore = await prisma.store.create({ data: { name: 'Owned store' } });
      const otherStore = await prisma.store.create({ data: { name: 'Other store' } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: ownedStore.id, role: 'owner' } });

      await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: otherStore.id,
          storeRole: 'staff',
          name: 'Outside Staff',
          email: faker.internet.email().toLowerCase(),
        })
        .expect(httpStatus.FORBIDDEN);
    });

    test('should allow manager to create staff but not another manager', async () => {
      await insertUsers([userOne]);
      const store = await prisma.store.create({ data: { name: 'Managed store' } });
      await prisma.userStoreRole.create({ data: { userId: userOne.id, storeId: store.id, role: 'manager' } });

      await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: store.id,
          storeRole: 'manager',
          name: 'Blocked Manager',
          email: faker.internet.email().toLowerCase(),
        })
        .expect(httpStatus.FORBIDDEN);

      const res = await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: store.id,
          storeRole: 'staff',
          name: 'Allowed Staff',
          email: faker.internet.email().toLowerCase(),
          password: 'password1',
        })
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        user: { name: 'Allowed Staff', isActive: true },
        existingAccount: false,
      });
      expect(await prisma.token.count({ where: { userId: res.body.user.id } })).toBe(0);
    });

    test('should allow owner to create manager for owned store', async () => {
      await insertUsers([userTwo]);
      const store = await prisma.store.create({ data: { name: 'Owner store' } });
      await prisma.userStoreRole.create({ data: { userId: userTwo.id, storeId: store.id, role: 'owner' } });

      const res = await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userTwo.id)}`)
        .send({
          storeId: store.id,
          storeRole: 'manager',
          name: 'Allowed Manager',
          email: faker.internet.email().toLowerCase(),
          password: 'password1',
        })
        .expect(httpStatus.CREATED);

      const role = await prisma.userStoreRole.findFirst({ where: { userId: res.body.user.id, storeId: store.id } });
      expect(role?.role).toBe('manager');
    });

    test('should assign an existing account to another store without resetting its password', async () => {
      await insertUsers([userOne, userTwo]);
      const [ownedStore, currentStore] = await Promise.all([
        prisma.store.create({ data: { name: 'New assigned store' } }),
        prisma.store.create({ data: { name: 'Current store' } }),
      ]);
      await prisma.userStoreRole.createMany({
        data: [
          { userId: userOne.id, storeId: ownedStore.id, role: 'owner' },
          { userId: userTwo.id, storeId: currentStore.id, role: 'staff' },
        ],
      });

      const res = await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: ownedStore.id,
          storeRole: 'staff',
          name: userTwo.name,
          email: userTwo.email,
        })
        .expect(httpStatus.CREATED);

      expect(res.body).toMatchObject({
        user: { id: userTwo.id },
        existingAccount: true,
      });
      expect(await prisma.userStoreRole.count({ where: { userId: userTwo.id } })).toBe(2);
      expect(await prisma.token.count({ where: { userId: userTwo.id } })).toBe(0);
    });

    test('should require an initial password for a new account', async () => {
      await insertUsers([userTwo]);
      const store = await prisma.store.create({ data: { name: 'Owner store' } });
      await prisma.userStoreRole.create({ data: { userId: userTwo.id, storeId: store.id, role: 'owner' } });

      await request(app)
        .post('/v1/admin/users')
        .set('Authorization', `Bearer ${createAccessToken(userTwo.id)}`)
        .send({
          storeId: store.id,
          storeRole: 'staff',
          name: 'Staff without password',
          email: faker.internet.email().toLowerCase(),
        })
        .expect(httpStatus.BAD_REQUEST);
    });

    test('should disable access only in the selected store', async () => {
      await insertUsers([userOne, userTwo]);
      const [managedStore, otherStore] = await Promise.all([
        prisma.store.create({ data: { name: 'Managed store' } }),
        prisma.store.create({ data: { name: 'Unaffected store' } }),
      ]);
      await prisma.userStoreRole.createMany({
        data: [
          { userId: userOne.id, storeId: managedStore.id, role: 'owner' },
          { userId: userTwo.id, storeId: managedStore.id, role: 'staff' },
          { userId: userTwo.id, storeId: otherStore.id, role: 'staff' },
        ],
      });

      await request(app)
        .patch(`/v1/admin/users/${userTwo.id}`)
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: managedStore.id,
          isActive: false,
        })
        .expect(httpStatus.OK);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userTwo.id },
        include: { storeRoles: true },
      });
      expect(user.isActive).toBe(true);
      expect(user.storeRoles.find((role) => role.storeId === managedStore.id)?.isActive).toBe(false);
      expect(user.storeRoles.find((role) => role.storeId === otherStore.id)?.isActive).toBe(true);

      const contextRes = await request(app)
        .get('/v1/stores/context')
        .set('Authorization', `Bearer ${createAccessToken(userTwo.id)}`)
        .expect(httpStatus.OK);
      expect(contextRes.body.stores).toEqual([
        expect.objectContaining({
          id: otherStore.id,
          role: 'staff',
        }),
      ]);
    });

    test('should prevent manager from locking the store owner', async () => {
      await insertUsers([userOne, userTwo]);
      const store = await prisma.store.create({ data: { name: 'Protected owner store' } });
      await prisma.userStoreRole.createMany({
        data: [
          { userId: userOne.id, storeId: store.id, role: 'manager' },
          { userId: userTwo.id, storeId: store.id, role: 'owner' },
        ],
      });

      await request(app)
        .patch(`/v1/admin/users/${userTwo.id}`)
        .set('Authorization', `Bearer ${createAccessToken(userOne.id)}`)
        .send({
          storeId: store.id,
          isActive: false,
        })
        .expect(httpStatus.FORBIDDEN);

      const owner = await prisma.user.findUniqueOrThrow({ where: { id: userTwo.id } });
      expect(owner.isActive).toBe(true);
    });
  });
});
