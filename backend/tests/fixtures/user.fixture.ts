import bcrypt from 'bcryptjs';
import faker from 'faker';
import { prisma } from '../../src/config/database.js';
import type { Role } from '../../src/generated/prisma/client.js';

const password = 'password1';
const salt = bcrypt.genSaltSync(8);
const hashedPassword = bcrypt.hashSync(password, salt);

const userOne = {
  id: faker.datatype.uuid(),
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user' as Role,
  isEmailVerified: false,
};

const userTwo = {
  id: faker.datatype.uuid(),
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'user' as Role,
  isEmailVerified: false,
};

const admin = {
  id: faker.datatype.uuid(),
  name: faker.name.findName(),
  email: faker.internet.email().toLowerCase(),
  password,
  role: 'admin' as Role,
  isEmailVerified: false,
};

const insertUsers = async (users) => {
  await prisma.user.createMany({
    data: users.map((user) => ({ ...user, password: hashedPassword })),
  });
};

export { userOne, userTwo, admin, insertUsers };
