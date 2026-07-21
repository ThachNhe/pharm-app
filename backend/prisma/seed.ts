import bcrypt from 'bcryptjs';
import { prisma, disconnectDB } from '../src/config/database.js';

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

  await Promise.all(
    users.map((user) =>
      prisma.user.upsert({
        where: { email: user.email },
        update: {
          name: user.name,
          phone: user.phone,
          role: user.role,
          isSystemAdmin: user.isSystemAdmin,
          isEmailVerified: true,
          isActive: true,
          password,
        },
        create: {
          ...user,
          password,
          isEmailVerified: true,
          isActive: true,
        },
      }),
    ),
  );
};

seedUsers()
  .then(() => {
    console.info(`Seeded ${users.length} users. Default password: ${seedPassword}`);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
