import bcrypt from 'bcryptjs';
import { prisma } from '../../src/config/database.js';
import { createSystemAdmin } from '../../src/scripts/createSystemAdmin.js';
import setupTestDB from '../utils/setupTestDB.js';

setupTestDB();

describe('createSystemAdmin', () => {
  test('creates an active System Admin with a hashed password', async () => {
    const input = {
      name: 'Production Admin',
      email: 'Admin@Example.com',
      password: 'securePassword1',
    };

    const result = await createSystemAdmin(input);
    const saved = await prisma.user.findUnique({ where: { email: 'admin@example.com' } });

    expect(result).toMatchObject({
      name: input.name,
      email: 'admin@example.com',
      role: 'admin',
      isSystemAdmin: true,
      isActive: true,
    });
    expect(result).not.toHaveProperty('password');
    expect(saved).not.toBeNull();
    expect(saved?.password).not.toBe(input.password);
    expect(await bcrypt.compare(input.password, saved!.password)).toBe(true);
  });

  test('does not replace an existing account', async () => {
    const input = {
      name: 'Production Admin',
      email: 'admin@example.com',
      password: 'securePassword1',
    };

    await createSystemAdmin(input);

    await expect(createSystemAdmin(input)).rejects.toThrow('already exists');
    await expect(prisma.user.count({ where: { email: input.email } })).resolves.toBe(1);
  });
});
