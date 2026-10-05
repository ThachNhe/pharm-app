import bcrypt from 'bcryptjs';
import { prisma, disconnectDB } from '../src/config/database.js';
import { defaultProductCategoryNames } from '../src/config/productCategories.js';

const seedPassword = '12345abcd';

const users = [
  {
    name: 'System Admin',
    email: 'admin@gmail.com',
    phone: '0900000001',
    role: 'admin' as const,
    isSystemAdmin: true,
  },
  {
    name: 'Demo Owner',
    email: 'owner@gmail.com',
    phone: '0900000002',
    role: 'user' as const,
    isSystemAdmin: false,
  },
  {
    name: 'Demo Manager',
    email: 'manager@gmail.com',
    phone: '0900000003',
    role: 'user' as const,
    isSystemAdmin: false,
  },
  {
    name: 'Demo Staff',
    email: 'staff@gmail.com',
    phone: '0900000004',
    role: 'user' as const,
    isSystemAdmin: false,
  },
];

const seedUsers = async () => {
  const password = await bcrypt.hash(seedPassword, 8);

  return Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          isSystemAdmin: user.isSystemAdmin,
          isActive: true,
          password,
        },
        create: {
          ...user,
          password,
          isActive: true,
        },
      }),
    ),
  );
};

const seedDemoStore = async (seededUsers: Awaited<ReturnType<typeof seedUsers>>) => {
  const store =
    (await prisma.store.findFirst({ where: { name: 'Nhà thuốc Demo' } })) ??
    (await prisma.store.create({
      data: {
        name: 'Nhà thuốc Demo',
        address: '123 Nguyễn Trãi, Thanh Xuân, Hà Nội',
        phone: '02439999999',
      },
    }));

  const userByEmail = new Map(seededUsers.map((user) => [user.email, user]));
  const memberships = [
    { email: 'owner@gmail.com', role: 'owner' as const },
    { email: 'manager@gmail.com', role: 'manager' as const },
    { email: 'staff@gmail.com', role: 'staff' as const },
  ];

  for (const membership of memberships) {
    const user = userByEmail.get(membership.email);
    if (!user) continue;
    await prisma.userStoreRole.upsert({
      where: {
        userId_storeId: {
          userId: user.id,
          storeId: store.id,
        },
      },
      update: { role: membership.role, isActive: true },
      create: {
        userId: user.id,
        storeId: store.id,
        role: membership.role,
        isActive: true,
      },
    });
  }

  const categories = await Promise.all(
    defaultProductCategoryNames.map((name) =>
      prisma.productCategory.upsert({
        where: { storeId_name: { storeId: store.id, name } },
        update: { isActive: true },
        create: { storeId: store.id, name },
      }),
    ),
  );
  const pharmaceuticalCategory = categories.find((category) => category.name === 'Dược phẩm');
  if (!pharmaceuticalCategory) throw new Error('Missing default pharmaceutical category');

  await prisma.supplier.upsert({
    where: {
      storeId_code: {
        storeId: store.id,
        code: 'NCC-DEMO',
      },
    },
    update: {
      name: 'Công ty Dược Demo',
      phone: '0909000000',
      isActive: true,
    },
    create: {
      storeId: store.id,
      code: 'NCC-DEMO',
      name: 'Công ty Dược Demo',
      phone: '0909000000',
      email: 'nhacungcap@example.com',
      address: 'Hà Nội',
    },
  });

  const medicine =
    (await prisma.medicine.findUnique({ where: { barcode: '8935001000012' } })) ??
    (await prisma.medicine.create({
      data: {
        name: 'Paracetamol 500mg',
        baseUnitName: 'Viên',
        barcode: '8935001000012',
        category: 'Giảm đau - hạ sốt',
        activeIngredient: 'Paracetamol',
        strength: '500mg',
        dosageForm: 'Viên nén',
        manufacturer: 'Dược Demo',
        units: {
          create: {
            name: 'Viên',
            conversionRate: 1,
            isBaseUnit: true,
          },
        },
      },
    }));

  await prisma.storeMedicine.upsert({
    where: {
      storeId_medicineId: {
        storeId: store.id,
        medicineId: medicine.id,
      },
    },
    update: {
      categoryId: pharmaceuticalCategory.id,
      code: 'SP-DEMO-001',
      positionName: 'Kệ A',
      sellingPrice: 2000,
      isActive: true,
    },
    create: {
      storeId: store.id,
      medicineId: medicine.id,
      categoryId: pharmaceuticalCategory.id,
      code: 'SP-DEMO-001',
      positionName: 'Kệ A',
      sellingPrice: 2000,
    },
  });

  return store;
};

seedUsers()
  .then(seedDemoStore)
  .then((store) => {
    console.info(`Seeded ${users.length} users and ${store.name}. Default password: ${seedPassword}`);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
