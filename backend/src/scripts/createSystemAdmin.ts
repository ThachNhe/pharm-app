import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import Joi from 'joi';
import { disconnectDB, prisma } from '../config/database.js';

type SystemAdminInput = {
  name: string;
  email: string;
  password: string;
};

const systemAdminSchema = Joi.object({
  name: Joi.string().trim().min(2).max(255).required(),
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string()
    .min(8)
    .max(100)
    .pattern(/[a-zA-Z]/)
    .pattern(/\d/)
    .required()
    .messages({
      'string.pattern.base': 'Password must contain at least 1 letter and 1 number',
    }),
});

const createSystemAdmin = async (rawInput: SystemAdminInput) => {
  const { value: input, error } = systemAdminSchema.validate(rawInput, {
    abortEarly: false,
    stripUnknown: true,
  });
  if (error) {
    throw new Error(error.details.map((detail) => detail.message).join('; '));
  }

  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new Error(`An account with email ${input.email} already exists`);
  }

  return prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      password: await bcrypt.hash(input.password, 8),
      role: 'admin',
      isSystemAdmin: true,
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isSystemAdmin: true,
      isActive: true,
    },
  });
};

const run = async () => {
  if (!process.stdin.isTTY) {
    throw new Error('This command must be run in an interactive terminal');
  }

  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  const askPassword = async (label: string) => {
    process.stdout.write(label);
    muted = true;
    try {
      return await prompt.question('');
    } finally {
      muted = false;
      process.stdout.write('\n');
    }
  };

  try {
    const name = await prompt.question('Full name: ');
    const email = await prompt.question('Email: ');
    const password = await askPassword('Password: ');
    const passwordConfirmation = await askPassword('Confirm password: ');
    if (password !== passwordConfirmation) {
      throw new Error('Password confirmation does not match');
    }

    const admin = await createSystemAdmin({ name, email, password });
    console.info(`System Admin created: ${admin.email}`);
  } finally {
    prompt.close();
  }
};

const isMain = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  run()
    .catch((error) => {
      console.error(error instanceof Error ? error.message : 'Unable to create System Admin');
      process.exitCode = 1;
    })
    .finally(disconnectDB);
}

export { createSystemAdmin };
