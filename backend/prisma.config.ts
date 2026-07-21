import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';
import config from './src/config/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../env/dev/backend.env'), override: false });

const isGenerateCommand = process.argv.includes('generate');
const databaseUrl = config.database.url;

if (!databaseUrl && !isGenerateCommand) {
  throw new Error('DATABASE_URL is required for Prisma commands that touch the database');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: databaseUrl ?? 'postgresql://user:password@localhost:5432/pharmdb',
  },
});
