import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma, disconnectDB } from '../config/database.js';

type JsonObject = Record<string, unknown>;

type ReferenceProductRow = {
  id: string;
  code: string | null;
  name: string;
  unitName: string | null;
  registrationNumber: string | null;
  barcode: string | null;
  secondaryBarcode: string | null;
  manufacturer: string | null;
  activeIngredient: string | null;
  specification: string | null;
  usageInstructions: string | null;
  categoryName: string | null;
  positionName: string | null;
  supplierName: string | null;
  inputPrice: string | null;
  referencePrice: string | null;
  wholesalePrice: string | null;
  doctorDiscountPercent: string | null;
  employeeDiscountPercent: string | null;
  minInventory: string | null;
  isInternal: boolean;
  isNational: boolean;
  isActive: boolean;
  syncedAt: Date;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const BATCH_SIZE = 200;

const optionalString = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const optionalPrice = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 ? String(value) : null;

const toReferenceProduct = (value: unknown, syncedAt: Date): ReferenceProductRow | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const product = value as JsonObject;
  const id = optionalString(product.ID);
  const name = optionalString(product.PRODUCT_NAME);
  if (!id || !UUID_PATTERN.test(id) || !name) return null;

  return {
    id,
    code: optionalString(product.CODE),
    name,
    unitName: optionalString(product.UNIT_NAME),
    registrationNumber: optionalString(product.GPNK),
    barcode: optionalString(product.BAR_CODE),
    secondaryBarcode: optionalString(product.BAR_CODE2),
    manufacturer: optionalString(product.PLACE_MANUFACTURE),
    activeIngredient: optionalString(product.ACTIVE_INGREDIENT),
    specification: optionalString(product.SPECIFICATION),
    usageInstructions: optionalString(product.CONTENT_PHARMA),
    categoryName: optionalString(product.CATEGORY_NAME),
    positionName: optionalString(product.POSITION_NAME),
    supplierName: optionalString(product.PROVIDER_NAME) ?? optionalString(product.IMPORT_COMPANY_NAME),
    inputPrice: optionalPrice(product.PRICE_INPUT),
    referencePrice: optionalPrice(product.PRICE_RETAIL),
    wholesalePrice: optionalPrice(product.PRICE_OUTPUT),
    doctorDiscountPercent: optionalPrice(product.DISCOUNT_PERCENT_DOCTOR),
    employeeDiscountPercent: optionalPrice(product.DISCOUNT_PERCENT_EMPLOYEE),
    minInventory: optionalPrice(product.INVENTORY_MIN),
    isInternal: product.IS_INTERNAL === true,
    isNational: product.IS_NATIONAL === true,
    isActive: true,
    syncedAt,
  };
};

const importReferenceProducts = async () => {
  const inputPath = path.resolve(process.cwd(), process.argv[2] ?? 'all_products.json');
  const parsed: unknown = JSON.parse(await fs.readFile(inputPath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Reference product file must contain a JSON array');

  const syncedAt = new Date();
  const rows = parsed.map((product) => toReferenceProduct(product, syncedAt)).filter((product) => product !== null);
  const uniqueRows = [...new Map(rows.map((product) => [product.id, product])).values()];
  const skippedCount = parsed.length - uniqueRows.length;

  for (let start = 0; start < uniqueRows.length; start += BATCH_SIZE) {
    const batch = uniqueRows.slice(start, start + BATCH_SIZE);
    await prisma.$transaction(
      batch.map(({ id, ...data }) =>
        prisma.referenceProduct.upsert({
          where: { id },
          update: data,
          create: { id, ...data },
        }),
      ),
    );

    const importedCount = start + batch.length;
    if (importedCount % 5000 < BATCH_SIZE || importedCount === uniqueRows.length) {
      console.info(`Imported ${importedCount}/${uniqueRows.length} reference products`);
    }
  }

  const storedCount = await prisma.referenceProduct.count();
  if (storedCount < uniqueRows.length) throw new Error('Reference product import verification failed');

  console.info(`Reference product import completed: ${uniqueRows.length} stored, ${skippedCount} skipped`);
};

importReferenceProducts()
  .catch((error) => {
    console.error('Reference product import failed:', error);
    process.exitCode = 1;
  })
  .finally(disconnectDB);
