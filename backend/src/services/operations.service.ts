import httpStatus from 'http-status';
import type { PaymentMethod, Prisma, StoreRole } from '../generated/prisma/client.js';
import { Prisma as PrismaRuntime } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';
import { getStoreAccess, getStoreOperationAccess, getStoreContext } from './storeAccess.service.js';

type Actor = Express.User;

type PageQuery = {
  page?: number | string;
  limit?: number | string;
  search?: string;
};

type DateQuery = PageQuery & {
  from?: string | Date;
  to?: string | Date;
};

type MedicineUnitPayload = {
  name: string;
  conversionRate: number | string;
  isBaseUnit: boolean;
};

type InitialImportPayload = {
  quantity: number | string;
  importPrice: number | string;
  batchNumber: string;
  expiryDate: string | Date;
};

type MedicinePayload = {
  referenceProductId?: string | null;
  categoryId: string;
  code?: string;
  positionName?: string | null;
  name: string;
  baseUnitName: string;
  barcode?: string | null;
  secondaryBarcode?: string | null;
  registrationNumber?: string | null;
  category?: string | null;
  activeIngredient?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  countryOfOrigin?: string | null;
  importerName?: string | null;
  specification?: string | null;
  usageInstructions?: string | null;
  requiresPrescription?: boolean;
  description?: string | null;
  sellingPrice: number | string;
  isActive?: boolean;
  units?: MedicineUnitPayload[];
  initialImport?: InitialImportPayload;
};

type ProductCategoryPayload = {
  name: string;
  description?: string | null;
  isActive?: boolean;
};

type ImportItemPayload = {
  medicineId: string;
  batchNumber: string;
  quantity: number | string;
  importPrice: number | string;
  expiryDate: string | Date;
  unitId?: string;
  sellingPrice?: number | string;
};

type ImportPayload = {
  supplierId?: string | null;
  importedAt?: string | Date;
  note?: string | null;
  items: ImportItemPayload[];
};

type SalePayload = {
  paymentMethod: PaymentMethod;
  discountAmount?: number | string;
  note?: string | null;
  items: Array<{
    medicineId: string;
    quantity: number | string;
    unitId?: string;
    expectedUnitPrice?: number | string;
  }>;
};

type SaleReturnPayload = {
  items: Array<{ saleDetailId: string; quantity: number | string }>;
  note?: string | null;
};

const asOptionalString = (value?: string | null) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeProductCode = (value: string) => value.trim().toUpperCase();

// ponytail: Codes are suggestions; the store unique constraint rejects concurrent duplicate saves.
const getNextProductCode = async (storeId: string) => {
  const [result] = await prisma.$queryRaw<Array<{ nextNumber: bigint }>>(PrismaRuntime.sql`
    SELECT COALESCE(MAX(SUBSTRING("code" FROM 3)::bigint), 0) + 1 AS "nextNumber"
    FROM "store_medicines"
    WHERE "store_id" = ${storeId}::uuid
      AND "code" ~ '^SP[0-9]{6,}$'
  `);
  return `SP${(result?.nextNumber ?? 1n).toString().padStart(6, '0')}`;
};

const toDecimal = (value: number | string | Prisma.Decimal) => new PrismaRuntime.Decimal(value);

const getUnitsKey = (units: Array<{ name: string; conversionRate: Prisma.Decimal }>) =>
  units
    .map((unit) => `${unit.name.trim().toLocaleLowerCase('vi')}:${unit.conversionRate.toFixed(4)}`)
    .sort()
    .join('|');

const TABLET_UNIT_NAME = 'Viên';
const BLISTER_UNIT_NAME = 'Vỉ';

const vndFormatter = new Intl.NumberFormat('vi-VN');
const formatVnd = (value: Prisma.Decimal) => `${vndFormatter.format(Number(value))} ₫`;

const isSameUnitName = (left: string, right: string) => left.localeCompare(right, 'vi', { sensitivity: 'accent' }) === 0;

const normalizeMedicineUnits = (baseUnitName: string, units?: MedicineUnitPayload[]) => {
  const normalizedBaseUnitName = baseUnitName.trim();
  const normalized = (units?.length ? units : [{ name: normalizedBaseUnitName, conversionRate: 1, isBaseUnit: true }]).map(
    (unit) => ({
      name: unit.name.trim(),
      conversionRate: toDecimal(unit.conversionRate),
      isBaseUnit: unit.isBaseUnit,
    }),
  );
  const baseUnits = normalized.filter((unit) => unit.isBaseUnit);
  if (
    baseUnits.length !== 1 ||
    baseUnits[0].name.localeCompare(normalizedBaseUnitName, 'vi', { sensitivity: 'accent' }) !== 0 ||
    !baseUnits[0].conversionRate.equals(1)
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Đơn vị nhỏ nhất phải có hệ số quy đổi bằng 1');
  }
  if (normalized.some((unit) => !unit.name || unit.name.length > 50 || unit.conversionRate.lte(0))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Đơn vị quy đổi không hợp lệ');
  }
  if (normalized.some((unit) => !unit.conversionRate.isInteger())) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Hệ số quy đổi phải là số nguyên');
  }
  if (normalized.some((unit) => !unit.isBaseUnit && unit.conversionRate.lte(1))) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Đơn vị quy đổi phải lớn hơn đơn vị nhỏ nhất');
  }
  // Business rule: only products counted by tablet may also be sold by blister; no other conversions exist.
  const packagingUnits = normalized.filter((unit) => !unit.isBaseUnit);
  if (
    packagingUnits.length &&
    (!isSameUnitName(normalizedBaseUnitName, TABLET_UNIT_NAME) ||
      packagingUnits.length > 1 ||
      !isSameUnitName(packagingUnits[0].name, BLISTER_UNIT_NAME))
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Chỉ sản phẩm tính theo viên mới được quy đổi, và chỉ sang vỉ');
  }
  const uniqueNames = new Set(normalized.map((unit) => unit.name.toLocaleLowerCase('vi')));
  if (uniqueNames.size !== normalized.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Tên đơn vị tính không được trùng nhau');
  }
  return normalized;
};

// One store-wide threshold (in base units) for the low-stock alert.
const LOW_STOCK_THRESHOLD = 10;

const BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';
const BUSINESS_UTC_OFFSET = '+07:00';
const businessDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const toDateKey = (value: string | Date) => {
  if (value instanceof Date) {
    return [
      value.getUTCFullYear(),
      String(value.getUTCMonth() + 1).padStart(2, '0'),
      String(value.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }
  return value.slice(0, 10);
};

const toBusinessDateKey = (value: Date) => {
  const parts = Object.fromEntries(
    businessDateFormatter
      .formatToParts(value)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const toDateOnly = (value: string | Date) => {
  return new Date(`${toDateKey(value)}T00:00:00.000Z`);
};

const getPagination = (query: PageQuery) => {
  const limit = Number(query.limit) > 0 ? Math.min(Number(query.limit), 100) : 20;
  const page = Number(query.page) > 0 ? Number(query.page) : 1;
  return { page, limit, skip: (page - 1) * limit };
};

const paginateRows = <T>(rows: T[], page: number, limit: number) => ({
  results: rows.slice((page - 1) * limit, page * limit),
  page,
  limit,
  totalPages: Math.ceil(rows.length / limit),
  totalResults: rows.length,
});

const getDateRange = (query: DateQuery) => {
  const getBoundary = (value: string | Date, endOfDay: boolean) => {
    const dateKey = toDateKey(value);
    const start = new Date(`${dateKey}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
    if (!endOfDay) return start;

    const nextDate = toDateOnly(value);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);
    const nextStart = new Date(`${toDateKey(nextDate)}T00:00:00.000${BUSINESS_UTC_OFFSET}`);
    return new Date(nextStart.getTime() - 1);
  };
  const from = query.from ? getBoundary(query.from, false) : undefined;
  const to = query.to ? getBoundary(query.to, true) : undefined;
  return {
    ...(from || to
      ? {
          gte: from,
          lte: to,
        }
      : {}),
  };
};

const currentBusinessDateOnly = () => new Date(`${toBusinessDateKey(new Date())}T00:00:00.000Z`);

const startOfCurrentBusinessDay = () => new Date(`${toBusinessDateKey(new Date())}T00:00:00.000${BUSINESS_UTC_OFFSET}`);

const addDays = (date: Date, days: number) => {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() + days);
  return value;
};

const writeAudit = async (
  tx: Prisma.TransactionClient,
  actor: Actor,
  data: {
    storeId: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) => {
  await tx.auditLog.create({
    data: {
      actorId: actor.id,
      storeId: data.storeId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId ?? null,
      metadata: data.metadata,
    },
  });
};

// Turns one import detail into sellable stock: a batch plus its inventory movement.
const receiveImportDetail = async (
  tx: Prisma.TransactionClient,
  actor: Actor,
  storeId: string,
  receiptId: string,
  detail: {
    id: string;
    medicineId: string;
    batchNumber: string;
    importPrice: Prisma.Decimal;
    expiryDate: Date;
    quantity: Prisma.Decimal;
  },
) => {
  const batch = await tx.stockBatch.create({
    data: {
      storeId,
      medicineId: detail.medicineId,
      importDetailId: detail.id,
      batchNumber: detail.batchNumber,
      importPrice: detail.importPrice,
      expiryDate: detail.expiryDate,
      quantityRemaining: detail.quantity,
    },
  });
  await tx.inventoryMovement.create({
    data: {
      storeId,
      medicineId: detail.medicineId,
      stockBatchId: batch.id,
      type: 'import',
      quantityDelta: detail.quantity,
      referenceType: 'import_receipt',
      referenceId: receiptId,
      createdBy: actor.id,
    },
  });
};

const serializeSupplier = (supplier) => ({
  ...supplier,
});

const serializeProductCategory = (category) => ({
  id: category.id,
  name: category.name,
  description: category.description,
  isActive: category.isActive,
  productCount: category._count?.storeMedicines ?? 0,
  createdAt: category.createdAt,
  updatedAt: category.updatedAt,
});

const serializeMedicine = (storeMedicine, stock?: { total: Prisma.Decimal; available: Prisma.Decimal }) => ({
  id: storeMedicine.medicine.id,
  storeMedicineId: storeMedicine.id,
  referenceProductId: storeMedicine.medicine.referenceProductId,
  code: storeMedicine.code,
  positionName: storeMedicine.positionName,
  name: storeMedicine.medicine.name,
  baseUnitName: storeMedicine.medicine.baseUnitName,
  barcode: storeMedicine.medicine.barcode,
  secondaryBarcode: storeMedicine.medicine.secondaryBarcode,
  registrationNumber: storeMedicine.medicine.registrationNumber,
  categoryId: storeMedicine.categoryId,
  category: storeMedicine.category.name,
  activeIngredient: storeMedicine.medicine.activeIngredient,
  strength: storeMedicine.medicine.strength,
  dosageForm: storeMedicine.medicine.dosageForm,
  manufacturer: storeMedicine.medicine.manufacturer,
  countryOfOrigin: storeMedicine.medicine.countryOfOrigin,
  importerName: storeMedicine.medicine.importerName,
  specification: storeMedicine.medicine.specification,
  usageInstructions: storeMedicine.medicine.usageInstructions,
  requiresPrescription: storeMedicine.medicine.requiresPrescription,
  description: storeMedicine.medicine.description,
  isActive: storeMedicine.isActive && storeMedicine.medicine.isActive,
  sellingPrice: Number(storeMedicine.sellingPrice),
  totalStock: Number(stock?.total ?? 0),
  availableStock: Number(stock?.available ?? 0),
  units: storeMedicine.medicine.units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    conversionRate: Number(unit.conversionRate),
    isBaseUnit: unit.isBaseUnit,
  })),
});

const serializeReferenceProduct = (referenceProduct) => ({
  id: referenceProduct.id,
  code: referenceProduct.code,
  name: referenceProduct.name,
  unitName: referenceProduct.unitName,
  registrationNumber: referenceProduct.registrationNumber,
  barcode: referenceProduct.barcode,
  secondaryBarcode: referenceProduct.secondaryBarcode,
  manufacturer: referenceProduct.manufacturer,
  countryOfOrigin: referenceProduct.countryOfOrigin,
  importerName: referenceProduct.importerName,
  activeIngredient: referenceProduct.activeIngredient,
  specification: referenceProduct.specification,
  usageInstructions: referenceProduct.usageInstructions,
  categoryName: referenceProduct.categoryName,
  positionName: referenceProduct.positionName,
  supplierName: referenceProduct.supplierName,
  inputPrice: referenceProduct.inputPrice === null ? null : Number(referenceProduct.inputPrice),
  referencePrice: referenceProduct.referencePrice === null ? null : Number(referenceProduct.referencePrice),
  wholesalePrice: referenceProduct.wholesalePrice === null ? null : Number(referenceProduct.wholesalePrice),
  doctorDiscountPercent:
    referenceProduct.doctorDiscountPercent === null ? null : Number(referenceProduct.doctorDiscountPercent),
  employeeDiscountPercent:
    referenceProduct.employeeDiscountPercent === null ? null : Number(referenceProduct.employeeDiscountPercent),
  minInventory: referenceProduct.minInventory === null ? null : Number(referenceProduct.minInventory),
  isInternal: referenceProduct.isInternal,
  isNational: referenceProduct.isNational,
  syncedAt: referenceProduct.syncedAt,
  isAddedToStore: Boolean(referenceProduct.medicine?.storeMedicines.length),
  medicineUnits:
    referenceProduct.medicine?.units.map((unit) => ({
      id: unit.id,
      name: unit.name,
      conversionRate: Number(unit.conversionRate),
      isBaseUnit: unit.isBaseUnit,
    })) ?? [],
});

const serializeImportReceipt = (receipt) => ({
  ...receipt,
  totalAmount: Number(receipt.totalAmount),
  details: receipt.details.map((detail) => ({
    ...detail,
    newSellingPrice: detail.newSellingPrice === null ? null : Number(detail.newSellingPrice),
    quantity: Number(detail.enteredQuantity),
    importPrice: Number(detail.enteredImportPrice),
    baseQuantity: Number(detail.quantity),
    baseImportPrice: Number(detail.importPrice),
    conversionRate: Number(detail.conversionRateSnapshot),
    unitName: detail.unitNameSnapshot,
  })),
});

const saleReturnsInclude = {
  orderBy: { createdAt: 'desc' },
  include: {
    createdByUser: { select: { id: true, name: true } },
    details: {
      include: {
        saleDetail: {
          select: {
            unitNameSnapshot: true,
            conversionRateSnapshot: true,
            medicine: { select: { name: true } },
            stockBatch: { select: { batchNumber: true } },
          },
        },
      },
    },
  },
} as const satisfies Prisma.SaleInclude['returns'];

const serializeSale = (sale, includeCosts = true) => ({
  ...sale,
  discountAmount: Number(sale.discountAmount),
  totalAmount: Number(sale.totalAmount),
  refundedAmount: Number(
    (sale.returns ?? []).reduce((sum, saleReturn) => sum.plus(saleReturn.refundAmount), new PrismaRuntime.Decimal(0)),
  ),
  returns: (sale.returns ?? []).map((saleReturn) => ({
    id: saleReturn.id,
    createdAt: saleReturn.createdAt,
    refundAmount: Number(saleReturn.refundAmount),
    note: saleReturn.note,
    createdByUser: saleReturn.createdByUser,
    details: saleReturn.details.map((detail) => ({
      id: detail.id,
      saleDetailId: detail.saleDetailId,
      medicineName: detail.saleDetail.medicine.name,
      batchNumber: detail.saleDetail.stockBatch.batchNumber,
      unitName: detail.saleDetail.unitNameSnapshot,
      displayQuantity: Number(detail.quantity.div(detail.saleDetail.conversionRateSnapshot)),
      refundAmount: Number(detail.refundAmount),
    })),
  })),
  details: sale.details.map((detail) => ({
    ...detail,
    quantity: Number(detail.quantity),
    returnedQuantity: Number(detail.returnedQuantity),
    displayReturnedQuantity: Number(detail.returnedQuantity.div(detail.conversionRateSnapshot)),
    salePrice: Number(detail.salePrice),
    displayQuantity: Number(detail.quantity.div(detail.conversionRateSnapshot)),
    displaySalePrice: Number(detail.salePrice.mul(detail.conversionRateSnapshot)),
    conversionRate: Number(detail.conversionRateSnapshot),
    unitName: detail.unitNameSnapshot,
    costPrice: includeCosts ? Number(detail.costPrice) : undefined,
  })),
});

const getContext = async (actor: Actor) => getStoreContext(actor);

const buildInventoryRows = async (storeId: string, search?: string) => {
  const storeMedicines = await prisma.storeMedicine.findMany({
    where: {
      storeId,
      ...(search
        ? {
            OR: [
              { code: { contains: search, mode: 'insensitive' } },
              { positionName: { contains: search, mode: 'insensitive' } },
              {
                medicine: {
                  OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { barcode: { contains: search, mode: 'insensitive' } },
                    { secondaryBarcode: { contains: search, mode: 'insensitive' } },
                    { activeIngredient: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            ],
          }
        : {}),
    },
    orderBy: { medicine: { name: 'asc' } },
    include: {
      medicine: { include: { units: { orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }] } } },
      category: true,
    },
  });

  const medicineIds = storeMedicines.map((item) => item.medicineId);
  const batches = medicineIds.length
    ? await prisma.stockBatch.findMany({
        where: {
          storeId,
          medicineId: { in: medicineIds },
          quantityRemaining: { gt: 0 },
        },
        orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
      })
    : [];

  const today = currentBusinessDateOnly();
  const expiringLimit = addDays(today, 60);

  return storeMedicines.map((storeMedicine) => {
    const medicineBatches = batches.filter((batch) => batch.medicineId === storeMedicine.medicineId);
    const totalStock = medicineBatches.reduce(
      (sum, batch) => sum.plus(batch.quantityRemaining),
      new PrismaRuntime.Decimal(0),
    );
    const availableStock = medicineBatches
      .filter((batch) => batch.expiryDate >= today)
      .reduce((sum, batch) => sum.plus(batch.quantityRemaining), new PrismaRuntime.Decimal(0));
    const inventoryValue = medicineBatches.reduce(
      (sum, batch) => sum.plus(batch.quantityRemaining.mul(batch.importPrice)),
      new PrismaRuntime.Decimal(0),
    );
    const nearestExpiry = medicineBatches.find((batch) => batch.expiryDate >= today)?.expiryDate ?? null;
    const hasExpiringBatch = medicineBatches.some((batch) => batch.expiryDate >= today && batch.expiryDate <= expiringLimit);

    return {
      ...serializeMedicine(storeMedicine, { total: totalStock, available: availableStock }),
      inventoryValue: Number(inventoryValue),
      nearestExpiry,
      isLowStock: availableStock.lte(LOW_STOCK_THRESHOLD),
      hasExpiringBatch,
      batches: medicineBatches.map((batch) => ({
        id: batch.id,
        batchNumber: batch.batchNumber,
        expiryDate: batch.expiryDate,
        importPrice: Number(batch.importPrice),
        quantityRemaining: Number(batch.quantityRemaining),
        isExpired: batch.expiryDate < today,
      })),
    };
  });
};

const hideInventoryCosts = (rows: Awaited<ReturnType<typeof buildInventoryRows>>) =>
  rows.map((item) => ({
    ...item,
    inventoryValue: undefined,
    batches: item.batches.map((batch) => ({
      ...batch,
      importPrice: undefined,
    })),
  }));

// Returns reduce revenue and cost on the day they are made, not on the original sale date.
const queryReturnsForReport = (storeId: string, createdAt?: ReturnType<typeof getDateRange>, soldBy?: string) =>
  prisma.saleReturn.findMany({
    where: { storeId, ...(createdAt ? { createdAt } : {}), ...(soldBy ? { sale: { soldBy } } : {}) },
    include: {
      details: {
        include: {
          saleDetail: {
            select: {
              medicineId: true,
              costPrice: true,
              medicine: { select: { id: true, name: true, baseUnitName: true } },
            },
          },
        },
      },
    },
  });

const getDashboard = async (actor: Actor, storeId: string) => {
  const access = await getStoreAccess(actor, storeId, 'staff');
  const today = startOfCurrentBusinessDay();
  const soldBy = !access.user.isSystemAdmin && access.role === 'staff' ? actor.id : undefined;
  const [sales, returns, inventory, supplierCount] = await Promise.all([
    prisma.sale.findMany({
      where: {
        storeId,
        status: { in: ['completed', 'refunded'] },
        soldAt: { gte: today },
        ...(soldBy ? { soldBy } : {}),
      },
      include: { details: true },
    }),
    queryReturnsForReport(storeId, { gte: today }, soldBy),
    buildInventoryRows(storeId),
    prisma.supplier.count({ where: { storeId, isActive: true } }),
  ]);

  const revenue = sales
    .reduce((sum, sale) => sum.plus(sale.totalAmount), new PrismaRuntime.Decimal(0))
    .minus(returns.reduce((sum, saleReturn) => sum.plus(saleReturn.refundAmount), new PrismaRuntime.Decimal(0)));
  const cost = sales
    .reduce(
      (sum, sale) =>
        sum.plus(
          sale.details.reduce(
            (detailSum, detail) => detailSum.plus(detail.costPrice.mul(detail.quantity)),
            new PrismaRuntime.Decimal(0),
          ),
        ),
      new PrismaRuntime.Decimal(0),
    )
    .minus(
      returns.reduce(
        (sum, saleReturn) =>
          sum.plus(
            saleReturn.details.reduce(
              (detailSum, detail) => detailSum.plus(detail.saleDetail.costPrice.mul(detail.quantity)),
              new PrismaRuntime.Decimal(0),
            ),
          ),
        new PrismaRuntime.Decimal(0),
      ),
    );
  const canViewFinancials = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';

  return {
    store: access.store,
    role: access.role,
    today: {
      revenue: Number(revenue),
      orders: sales.filter((sale) => sale.status === 'completed').length,
      ...(canViewFinancials
        ? {
            cost: Number(cost),
            grossProfit: Number(revenue.minus(cost)),
          }
        : {}),
    },
    inventory: {
      medicineCount: inventory.filter((item) => item.isActive).length,
      lowStockCount: inventory.filter((item) => item.isLowStock).length,
      expiringCount: inventory.filter((item) => item.hasExpiringBatch).length,
      ...(canViewFinancials
        ? {
            value: inventory.reduce((sum, item) => sum + item.inventoryValue, 0),
          }
        : {}),
    },
    supplierCount,
  };
};

const querySuppliers = async (actor: Actor, storeId: string, query: PageQuery) => {
  await getStoreAccess(actor, storeId, 'staff');
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.SupplierWhereInput = {
    storeId,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { code: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.supplier.count({ where }),
    prisma.supplier.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
    }),
  ]);

  return {
    results: results.map(serializeSupplier),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const createSupplier = async (actor: Actor, storeId: string, body) => {
  await getStoreAccess(actor, storeId, 'manager');
  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.create({
      data: {
        storeId,
        code: asOptionalString(body.code),
        name: body.name.trim(),
        phone: asOptionalString(body.phone),
        email: asOptionalString(body.email),
        address: asOptionalString(body.address),
        taxCode: asOptionalString(body.taxCode),
        isActive: body.isActive ?? true,
      },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'supplier.create',
      targetType: 'supplier',
      targetId: supplier.id,
    });
    return serializeSupplier(supplier);
  });
};

const updateSupplier = async (actor: Actor, storeId: string, supplierId: string, body) => {
  await getStoreAccess(actor, storeId, 'manager');
  const existing = await prisma.supplier.findFirst({ where: { id: supplierId, storeId } });
  if (!existing) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy nhà cung cấp');
  }

  return prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.update({
      where: { id: supplierId },
      data: {
        code: body.code === undefined ? undefined : asOptionalString(body.code),
        name: body.name?.trim(),
        phone: body.phone === undefined ? undefined : asOptionalString(body.phone),
        email: body.email === undefined ? undefined : asOptionalString(body.email),
        address: body.address === undefined ? undefined : asOptionalString(body.address),
        taxCode: body.taxCode === undefined ? undefined : asOptionalString(body.taxCode),
        isActive: body.isActive,
      },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'supplier.update',
      targetType: 'supplier',
      targetId: supplier.id,
      metadata: { isActive: supplier.isActive },
    });
    return serializeSupplier(supplier);
  });
};

const queryProductCategories = async (actor: Actor, storeId: string, query: PageQuery & { active?: string | boolean }) => {
  await getStoreAccess(actor, storeId, 'staff');
  const { page, limit, skip } = getPagination(query);
  const active = query.active === undefined ? undefined : query.active === true || query.active === 'true';
  const where: Prisma.ProductCategoryWhereInput = {
    storeId,
    isActive: active,
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { description: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.productCategory.count({ where }),
    prisma.productCategory.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      skip,
      take: limit,
      include: { _count: { select: { storeMedicines: true } } },
    }),
  ]);

  return {
    results: results.map(serializeProductCategory),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const createProductCategory = async (actor: Actor, storeId: string, body: ProductCategoryPayload) => {
  await getStoreAccess(actor, storeId, 'manager');
  const name = body.name.trim();

  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.productCategory.findFirst({
      where: { storeId, name: { equals: name, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicate) throw new ApiError(httpStatus.CONFLICT, 'Nhóm sản phẩm đã tồn tại');

    const category = await tx.productCategory.create({
      data: {
        storeId,
        name,
        description: asOptionalString(body.description),
        isActive: body.isActive ?? true,
      },
      include: { _count: { select: { storeMedicines: true } } },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'product_category.create',
      targetType: 'product_category',
      targetId: category.id,
    });
    return serializeProductCategory(category);
  });
};

const updateProductCategory = async (
  actor: Actor,
  storeId: string,
  categoryId: string,
  body: Partial<ProductCategoryPayload>,
) => {
  await getStoreAccess(actor, storeId, 'manager');
  const existing = await prisma.productCategory.findFirst({ where: { id: categoryId, storeId } });
  if (!existing) throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy nhóm sản phẩm');

  return prisma.$transaction(async (tx) => {
    const name = body.name?.trim();
    if (name) {
      const duplicate = await tx.productCategory.findFirst({
        where: { id: { not: categoryId }, storeId, name: { equals: name, mode: 'insensitive' } },
        select: { id: true },
      });
      if (duplicate) throw new ApiError(httpStatus.CONFLICT, 'Nhóm sản phẩm đã tồn tại');
    }

    const category = await tx.productCategory.update({
      where: { id: categoryId },
      data: {
        name,
        description: body.description === undefined ? undefined : asOptionalString(body.description),
        isActive: body.isActive,
      },
      include: { _count: { select: { storeMedicines: true } } },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'product_category.update',
      targetType: 'product_category',
      targetId: category.id,
      metadata: { isActive: category.isActive },
    });
    return serializeProductCategory(category);
  });
};

const queryMedicines = async (
  actor: Actor,
  storeId: string,
  query: PageQuery & { alert?: 'low' | 'expiring'; active?: string | boolean; inStockFirst?: string | boolean },
) => {
  const access = await getStoreAccess(actor, storeId, 'staff');
  const { page, limit } = getPagination(query);
  let rows = await buildInventoryRows(storeId, query.search);
  if (query.alert === 'low') rows = rows.filter((item) => item.isLowStock);
  if (query.alert === 'expiring') rows = rows.filter((item) => item.hasExpiringBatch);
  if (query.active !== undefined) {
    const active = query.active === true || query.active === 'true';
    rows = rows.filter((item) => item.isActive === active);
  }
  // Stable sort keeps the name order inside each group; must run before pagination.
  if (query.inStockFirst === true || query.inStockFirst === 'true') {
    rows = [...rows].sort((a, b) => Number(b.availableStock > 0) - Number(a.availableStock > 0));
  }
  const canViewCosts = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';
  return paginateRows(canViewCosts ? rows : hideInventoryCosts(rows), page, limit);
};

const queryReferenceProducts = async (actor: Actor, storeId: string, query: PageQuery) => {
  await getStoreAccess(actor, storeId, 'staff');
  const { page, limit, skip } = getPagination(query);
  const search = query.search?.trim();
  const where: Prisma.ReferenceProductWhereInput = {
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { barcode: { contains: search, mode: 'insensitive' } },
            { secondaryBarcode: { contains: search, mode: 'insensitive' } },
            { manufacturer: { contains: search, mode: 'insensitive' } },
            { registrationNumber: { contains: search, mode: 'insensitive' } },
            { activeIngredient: { contains: search, mode: 'insensitive' } },
            { categoryName: { contains: search, mode: 'insensitive' } },
            { countryOfOrigin: { contains: search, mode: 'insensitive' } },
            { importerName: { contains: search, mode: 'insensitive' } },
            { positionName: { contains: search, mode: 'insensitive' } },
            { supplierName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.referenceProduct.count({ where }),
    prisma.referenceProduct.findMany({
      where,
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      skip,
      take: limit,
      include: {
        medicine: {
          select: {
            units: { orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }] },
            storeMedicines: {
              where: { storeId },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    }),
  ]);

  return {
    results: results.map(serializeReferenceProduct),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const createMedicine = async (actor: Actor, storeId: string, body: MedicinePayload) => {
  const { initialImport } = body;
  if (initialImport) {
    await getStoreOperationAccess(actor, storeId, 'manager');
    if (toDateOnly(initialImport.expiryDate) <= currentBusinessDateOnly()) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Hạn sử dụng phải sau ngày hiện tại');
    }
  } else {
    await getStoreAccess(actor, storeId, 'manager');
  }
  const code = body.code ? normalizeProductCode(body.code) : await getNextProductCode(storeId);

  return prisma.$transaction(async (tx) => {
    const productCategory = await tx.productCategory.findFirst({
      where: { id: body.categoryId, storeId, isActive: true },
    });
    if (!productCategory) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Nhóm sản phẩm không hợp lệ hoặc đã ngừng hoạt động');
    }

    const duplicateCode = await tx.storeMedicine.findFirst({
      where: { storeId, code: { equals: code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (duplicateCode) throw new ApiError(httpStatus.CONFLICT, 'Mã hàng hóa đã tồn tại trong quầy');

    let referenceProduct: {
      id: string;
      name: string;
      unitName: string | null;
      registrationNumber: string | null;
      barcode: string | null;
      secondaryBarcode: string | null;
      manufacturer: string | null;
      countryOfOrigin: string | null;
      importerName: string | null;
      activeIngredient: string | null;
      specification: string | null;
      usageInstructions: string | null;
      categoryName: string | null;
      positionName: string | null;
    } | null = null;
    if (body.referenceProductId) {
      referenceProduct = await tx.referenceProduct.findFirst({
        where: { id: body.referenceProductId, isActive: true },
        select: {
          id: true,
          name: true,
          unitName: true,
          registrationNumber: true,
          barcode: true,
          secondaryBarcode: true,
          manufacturer: true,
          countryOfOrigin: true,
          importerName: true,
          activeIngredient: true,
          specification: true,
          usageInstructions: true,
          categoryName: true,
          positionName: true,
        },
      });
      if (!referenceProduct) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy sản phẩm trong thư viện');
      }
    }

    const referenceBarcodes = referenceProduct
      ? [
          ...new Set([asOptionalString(referenceProduct.barcode), asOptionalString(referenceProduct.secondaryBarcode)]),
        ].filter((barcode): barcode is string => Boolean(barcode))
      : [];
    const usedBarcodes = referenceBarcodes.length
      ? await tx.medicine.findMany({
          where: {
            OR: [{ barcode: { in: referenceBarcodes } }, { secondaryBarcode: { in: referenceBarcodes } }],
          },
          select: { barcode: true, secondaryBarcode: true },
        })
      : [];
    const usedBarcodeSet = new Set(usedBarcodes.flatMap(({ barcode, secondaryBarcode }) => [barcode, secondaryBarcode]));
    const availableReferenceBarcodes = referenceBarcodes.filter((barcode) => !usedBarcodeSet.has(barcode));
    const manualBarcodes = [asOptionalString(body.barcode), asOptionalString(body.secondaryBarcode)].filter(
      (barcode): barcode is string => Boolean(barcode),
    );
    if (!referenceProduct && new Set(manualBarcodes).size !== manualBarcodes.length) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Mã vạch 1 và mã vạch 2 không được trùng nhau');
    }
    if (!referenceProduct && manualBarcodes.length) {
      const barcodeConflict = await tx.medicine.findFirst({
        where: { OR: [{ barcode: { in: manualBarcodes } }, { secondaryBarcode: { in: manualBarcodes } }] },
        select: { id: true },
      });
      if (barcodeConflict) throw new ApiError(httpStatus.CONFLICT, 'Mã vạch đã được sử dụng cho sản phẩm khác');
    }

    const baseUnitName = referenceProduct?.unitName?.trim() || body.baseUnitName.trim();
    const medicineUnits = normalizeMedicineUnits(baseUnitName, body.units);
    const medicineData: Prisma.MedicineCreateInput = {
      referenceProduct: body.referenceProductId ? { connect: { id: body.referenceProductId } } : undefined,
      name: referenceProduct?.name ?? body.name.trim(),
      baseUnitName,
      barcode: referenceProduct ? (availableReferenceBarcodes[0] ?? null) : asOptionalString(body.barcode),
      secondaryBarcode: referenceProduct ? (availableReferenceBarcodes[1] ?? null) : asOptionalString(body.secondaryBarcode),
      registrationNumber: referenceProduct?.registrationNumber ?? asOptionalString(body.registrationNumber),
      category: referenceProduct?.categoryName ?? productCategory.name,
      activeIngredient: referenceProduct?.activeIngredient ?? asOptionalString(body.activeIngredient),
      strength: asOptionalString(body.strength),
      dosageForm: asOptionalString(body.dosageForm),
      manufacturer: referenceProduct ? asOptionalString(referenceProduct.manufacturer) : asOptionalString(body.manufacturer),
      countryOfOrigin: referenceProduct
        ? asOptionalString(referenceProduct.countryOfOrigin)
        : asOptionalString(body.countryOfOrigin),
      importerName: referenceProduct ? asOptionalString(referenceProduct.importerName) : asOptionalString(body.importerName),
      specification: referenceProduct
        ? asOptionalString(referenceProduct.specification)
        : asOptionalString(body.specification),
      usageInstructions: referenceProduct
        ? asOptionalString(referenceProduct.usageInstructions)
        : asOptionalString(body.usageInstructions),
      requiresPrescription: body.requiresPrescription ?? false,
      description: asOptionalString(body.description),
      units: {
        create: medicineUnits,
      },
    };
    const medicine = body.referenceProductId
      ? await tx.medicine.upsert({
          where: { referenceProductId: body.referenceProductId },
          update: {},
          create: medicineData,
        })
      : await tx.medicine.create({ data: medicineData });

    const existingAssignment = await tx.storeMedicine.findUnique({
      where: { storeId_medicineId: { storeId, medicineId: medicine.id } },
      select: { id: true },
    });
    if (existingAssignment) {
      throw new ApiError(httpStatus.CONFLICT, 'Sản phẩm này đã có trong danh mục của quầy');
    }

    const storeMedicine = await tx.storeMedicine.create({
      data: {
        storeId,
        medicineId: medicine.id,
        categoryId: productCategory.id,
        code,
        positionName: asOptionalString(body.positionName ?? referenceProduct?.positionName),
        sellingPrice: toDecimal(body.sellingPrice),
        isActive: body.isActive ?? true,
      },
      include: {
        medicine: { include: { units: { orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }] } } },
        category: true,
      },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'medicine.create',
      targetType: 'medicine',
      targetId: medicine.id,
      metadata: body.referenceProductId ? { referenceProductId: body.referenceProductId } : undefined,
    });

    if (!initialImport) return serializeMedicine(storeMedicine);

    // A new product's first stock is a completed import receipt in base units, created with the product.
    const quantity = toDecimal(initialImport.quantity);
    const importPrice = toDecimal(initialImport.importPrice);
    const totalAmount = quantity.mul(importPrice);
    const receipt = await tx.importReceipt.create({
      data: {
        storeId,
        createdBy: actor.id,
        status: 'completed',
        totalAmount,
        details: {
          create: {
            storeId,
            medicineId: medicine.id,
            batchNumber: initialImport.batchNumber.trim(),
            quantity,
            importPrice,
            enteredQuantity: quantity,
            enteredImportPrice: importPrice,
            unitNameSnapshot: medicine.baseUnitName,
            conversionRateSnapshot: toDecimal(1),
            expiryDate: toDateOnly(initialImport.expiryDate),
          },
        },
      },
      include: { details: true },
    });
    await receiveImportDetail(tx, actor, storeId, receipt.id, receipt.details[0]);
    await writeAudit(tx, actor, {
      storeId,
      action: 'import.complete',
      targetType: 'import_receipt',
      targetId: receipt.id,
      metadata: { totalAmount: Number(totalAmount), itemCount: 1, newMedicineId: medicine.id },
    });
    return serializeMedicine(storeMedicine, { total: quantity, available: quantity });
  });
};

const generateMedicineCode = async (actor: Actor, storeId: string) => {
  await getStoreAccess(actor, storeId, 'manager');
  return { code: await getNextProductCode(storeId) };
};

const updateMedicine = async (
  actor: Actor,
  storeId: string,
  medicineId: string,
  body: Partial<MedicinePayload> & { isActive?: boolean },
) => {
  await getStoreAccess(actor, storeId, 'manager');
  const assigned = await prisma.storeMedicine.findUnique({
    where: { storeId_medicineId: { storeId, medicineId } },
    include: {
      medicine: {
        select: {
          referenceProductId: true,
          barcode: true,
          secondaryBarcode: true,
          baseUnitName: true,
          units: true,
        },
      },
    },
  });
  if (!assigned) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Thuốc chưa được cấu hình tại quầy này');
  }

  const changesSharedDetails =
    body.name !== undefined ||
    body.baseUnitName !== undefined ||
    body.barcode !== undefined ||
    body.secondaryBarcode !== undefined ||
    body.registrationNumber !== undefined ||
    body.category !== undefined ||
    body.activeIngredient !== undefined ||
    body.strength !== undefined ||
    body.dosageForm !== undefined ||
    body.manufacturer !== undefined ||
    body.countryOfOrigin !== undefined ||
    body.importerName !== undefined ||
    body.specification !== undefined ||
    body.usageInstructions !== undefined ||
    body.requiresPrescription !== undefined ||
    body.description !== undefined;
  if (assigned.medicine.referenceProductId && changesSharedDetails) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Thông tin thuốc từ thư viện chỉ được sửa bởi System Admin');
  }
  const medicineUnits = body.units
    ? normalizeMedicineUnits(body.baseUnitName ?? assigned.medicine.baseUnitName, body.units)
    : null;
  const unitsChanged = medicineUnits !== null && getUnitsKey(medicineUnits) !== getUnitsKey(assigned.medicine.units);
  if (unitsChanged) {
    // Units live on the medicine shared by every store using it; changing them would alter other stores' stock math.
    const otherStoreCount = await prisma.storeMedicine.count({ where: { medicineId, storeId: { not: storeId } } });
    if (otherStoreCount > 0) {
      throw new ApiError(httpStatus.CONFLICT, 'Quy đổi đơn vị đang được quầy khác dùng chung nên không thể thay đổi');
    }
  }

  return prisma.$transaction(async (tx) => {
    if (body.code !== undefined) {
      const code = normalizeProductCode(body.code);
      const duplicateCode = await tx.storeMedicine.findFirst({
        where: { id: { not: assigned.id }, storeId, code: { equals: code, mode: 'insensitive' } },
        select: { id: true },
      });
      if (duplicateCode) throw new ApiError(httpStatus.CONFLICT, 'Mã hàng hóa đã tồn tại trong quầy');
    }

    if (body.categoryId && body.categoryId !== assigned.categoryId) {
      const category = await tx.productCategory.findFirst({
        where: { id: body.categoryId, storeId, isActive: true },
        select: { id: true },
      });
      if (!category) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Nhóm sản phẩm không hợp lệ hoặc đã ngừng hoạt động');
      }
    }

    if (changesSharedDetails) {
      if (
        body.baseUnitName &&
        body.baseUnitName.trim().localeCompare(assigned.medicine.baseUnitName, 'vi', { sensitivity: 'accent' }) !== 0
      ) {
        const [importDetailCount, saleDetailCount] = await Promise.all([
          tx.importDetail.count({ where: { medicineId } }),
          tx.saleDetail.count({ where: { medicineId } }),
        ]);
        if (importDetailCount || saleDetailCount) {
          throw new ApiError(httpStatus.CONFLICT, 'Không thể đổi đơn vị nhỏ nhất của thuốc đã phát sinh nhập hoặc bán');
        }
      }
      const requestedBarcodes = [
        body.barcode === undefined ? assigned.medicine.barcode : asOptionalString(body.barcode),
        body.secondaryBarcode === undefined ? assigned.medicine.secondaryBarcode : asOptionalString(body.secondaryBarcode),
      ];
      const suppliedBarcodes = requestedBarcodes.filter((barcode): barcode is string => Boolean(barcode));
      if (new Set(suppliedBarcodes).size !== suppliedBarcodes.length) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Mã vạch 1 và mã vạch 2 không được trùng nhau');
      }
      if (suppliedBarcodes.length) {
        const barcodeConflict = await tx.medicine.findFirst({
          where: {
            id: { not: medicineId },
            OR: [{ barcode: { in: suppliedBarcodes } }, { secondaryBarcode: { in: suppliedBarcodes } }],
          },
          select: { id: true },
        });
        if (barcodeConflict) throw new ApiError(httpStatus.CONFLICT, 'Mã vạch đã được sử dụng cho sản phẩm khác');
      }
      await tx.medicine.update({
        where: { id: medicineId },
        data: {
          name: body.name?.trim(),
          baseUnitName: body.baseUnitName?.trim(),
          barcode: body.barcode === undefined ? undefined : asOptionalString(body.barcode),
          secondaryBarcode: body.secondaryBarcode === undefined ? undefined : asOptionalString(body.secondaryBarcode),
          registrationNumber: body.registrationNumber === undefined ? undefined : asOptionalString(body.registrationNumber),
          category: body.category === undefined ? undefined : asOptionalString(body.category),
          activeIngredient: body.activeIngredient === undefined ? undefined : asOptionalString(body.activeIngredient),
          strength: body.strength === undefined ? undefined : asOptionalString(body.strength),
          dosageForm: body.dosageForm === undefined ? undefined : asOptionalString(body.dosageForm),
          manufacturer: body.manufacturer === undefined ? undefined : asOptionalString(body.manufacturer),
          countryOfOrigin: body.countryOfOrigin === undefined ? undefined : asOptionalString(body.countryOfOrigin),
          importerName: body.importerName === undefined ? undefined : asOptionalString(body.importerName),
          specification: body.specification === undefined ? undefined : asOptionalString(body.specification),
          usageInstructions: body.usageInstructions === undefined ? undefined : asOptionalString(body.usageInstructions),
          requiresPrescription: body.requiresPrescription,
          description: body.description === undefined ? undefined : asOptionalString(body.description),
        },
      });

      if (body.baseUnitName) {
        await tx.medicineUnit.updateMany({
          where: { medicineId, isBaseUnit: true },
          data: { name: body.baseUnitName.trim() },
        });
      }
    }

    if (medicineUnits && unitsChanged) {
      await tx.medicineUnit.deleteMany({ where: { medicineId } });
      await tx.medicineUnit.createMany({
        data: medicineUnits.map((unit) => ({ medicineId, ...unit })),
      });
    }

    const updated = await tx.storeMedicine.update({
      where: { storeId_medicineId: { storeId, medicineId } },
      data: {
        categoryId: body.categoryId,
        code: body.code === undefined ? undefined : normalizeProductCode(body.code),
        positionName: body.positionName === undefined ? undefined : asOptionalString(body.positionName),
        sellingPrice: body.sellingPrice === undefined ? undefined : toDecimal(body.sellingPrice),
        isActive: body.isActive,
      },
      include: {
        medicine: { include: { units: { orderBy: [{ isBaseUnit: 'desc' }, { conversionRate: 'asc' }] } } },
        category: true,
      },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'medicine.update',
      targetType: 'medicine',
      targetId: medicineId,
      metadata: {
        code: updated.code,
        positionName: updated.positionName,
        sellingPrice: Number(updated.sellingPrice),
        isActive: updated.isActive,
        categoryId: updated.categoryId,
      },
    });
    return serializeMedicine(updated);
  });
};

const validateImportReferences = async (
  storeId: string,
  supplierId: string | null | undefined,
  items: ImportItemPayload[],
) => {
  if (supplierId) {
    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, storeId, isActive: true },
    });
    if (!supplier) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Nhà cung cấp không hợp lệ');
    }
  }

  const medicineIds = [...new Set(items.map((item) => item.medicineId))];
  const configuredMedicines = await prisma.storeMedicine.findMany({
    where: {
      storeId,
      medicineId: { in: medicineIds },
      isActive: true,
      medicine: { isActive: true },
    },
    include: { medicine: { include: { units: true } } },
  });
  if (configuredMedicines.length !== medicineIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Có thuốc chưa được cấu hình hoặc đã ngừng bán tại quầy');
  }

  const duplicateKeys = items.map((item) => `${item.medicineId}:${item.batchNumber.trim().toLowerCase()}`);
  if (new Set(duplicateKeys).size !== duplicateKeys.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Không được nhập trùng thuốc và số lô trong cùng phiếu');
  }

  const today = currentBusinessDateOnly();
  if (items.some((item) => toDateOnly(item.expiryDate) <= today)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Hạn sử dụng phải sau ngày hiện tại');
  }

  const sellingPriceByMedicine = new Map<string, string>();
  for (const item of items) {
    if (item.sellingPrice === undefined) continue;
    const price = toDecimal(item.sellingPrice).toFixed(2);
    const existing = sellingPriceByMedicine.get(item.medicineId);
    if (existing !== undefined && existing !== price) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Một sản phẩm chỉ được đặt một giá bán mới trong cùng phiếu');
    }
    sellingPriceByMedicine.set(item.medicineId, price);
  }

  const configuredByMedicine = new Map(configuredMedicines.map((item) => [item.medicineId, item]));
  return items.map((item) => {
    const configured = configuredByMedicine.get(item.medicineId);
    const unit = item.unitId
      ? configured?.medicine.units.find((candidate) => candidate.id === item.unitId)
      : configured?.medicine.units.find((candidate) => candidate.isBaseUnit);
    if (!unit) throw new ApiError(httpStatus.BAD_REQUEST, 'Đơn vị nhập không hợp lệ cho thuốc đã chọn');
    const enteredQuantity = toDecimal(item.quantity);
    const enteredImportPrice = toDecimal(item.importPrice);
    const quantity = enteredQuantity.mul(unit.conversionRate);
    if (quantity.decimalPlaces() > 2) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Số lượng sau quy đổi chỉ được có tối đa 2 chữ số thập phân');
    }
    return {
      ...item,
      enteredQuantity,
      enteredImportPrice,
      quantity,
      importPrice: enteredImportPrice.div(unit.conversionRate),
      newSellingPrice: item.sellingPrice === undefined ? null : toDecimal(item.sellingPrice),
      unit,
    };
  });
};

const getImportTotal = (items: ImportItemPayload[]) =>
  items.reduce(
    (sum, item) => sum.plus(toDecimal(item.quantity).mul(toDecimal(item.importPrice))),
    new PrismaRuntime.Decimal(0),
  );

const createImportReceipt = async (actor: Actor, storeId: string, body: ImportPayload) => {
  await getStoreOperationAccess(actor, storeId, 'manager');
  const resolvedItems = await validateImportReferences(storeId, body.supplierId, body.items);
  const supplier = body.supplierId ? await prisma.supplier.findFirst({ where: { id: body.supplierId, storeId } }) : null;
  const totalAmount = getImportTotal(body.items);

  const receipt = await prisma.$transaction(async (tx) => {
    const created = await tx.importReceipt.create({
      data: {
        storeId,
        createdBy: actor.id,
        supplierId: supplier?.id ?? null,
        supplierNameSnapshot: supplier?.name ?? null,
        status: 'draft',
        totalAmount,
        note: asOptionalString(body.note),
        importedAt: body.importedAt ? new Date(body.importedAt) : new Date(),
        details: {
          create: resolvedItems.map((item) => ({
            storeId,
            medicineId: item.medicineId,
            batchNumber: item.batchNumber.trim(),
            quantity: item.quantity,
            importPrice: item.importPrice,
            enteredQuantity: item.enteredQuantity,
            enteredImportPrice: item.enteredImportPrice,
            unitNameSnapshot: item.unit.name,
            conversionRateSnapshot: item.unit.conversionRate,
            expiryDate: toDateOnly(item.expiryDate),
            newSellingPrice: item.newSellingPrice,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        details: {
          include: { medicine: { select: { id: true, name: true, baseUnitName: true } } },
        },
      },
    });
    await writeAudit(tx, actor, {
      storeId,
      action: 'import.create_draft',
      targetType: 'import_receipt',
      targetId: created.id,
      metadata: { totalAmount: Number(totalAmount), itemCount: body.items.length },
    });
    return created;
  });

  return serializeImportReceipt(receipt);
};

const queryImportReceipts = async (actor: Actor, storeId: string, query: DateQuery & { status?: string }) => {
  await getStoreAccess(actor, storeId, 'manager');
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ImportReceiptWhereInput = {
    storeId,
    ...(query.status ? { status: query.status as Prisma.EnumReceiptStatusFilter['equals'] } : {}),
    ...(query.from || query.to ? { importedAt: getDateRange(query) } : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.importReceipt.count({ where }),
    prisma.importReceipt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        supplier: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        details: {
          include: { medicine: { select: { id: true, name: true, baseUnitName: true } } },
        },
      },
    }),
  ]);
  return {
    results: results.map(serializeImportReceipt),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const getImportReceipt = async (actor: Actor, storeId: string, receiptId: string) => {
  await getStoreAccess(actor, storeId, 'manager');
  const receipt = await prisma.importReceipt.findFirst({
    where: { id: receiptId, storeId },
    include: {
      supplier: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, name: true } },
      details: {
        include: { medicine: { select: { id: true, name: true, baseUnitName: true } } },
      },
    },
  });
  if (!receipt) throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy phiếu nhập');
  const storeMedicines = await prisma.storeMedicine.findMany({
    where: { storeId, medicineId: { in: receipt.details.map((detail) => detail.medicineId) } },
    select: { medicineId: true, sellingPrice: true },
  });
  const currentPrices = new Map(storeMedicines.map((item) => [item.medicineId, Number(item.sellingPrice)]));
  const serialized = serializeImportReceipt(receipt);
  return {
    ...serialized,
    details: serialized.details.map((detail) => ({
      ...detail,
      currentSellingPrice: currentPrices.get(detail.medicineId) ?? null,
    })),
  };
};

const completeImportReceipt = async (actor: Actor, storeId: string, receiptId: string) => {
  await getStoreOperationAccess(actor, storeId, 'manager');

  try {
    const receipt = await prisma.$transaction(
      async (tx) => {
        const draft = await tx.importReceipt.findFirst({
          where: { id: receiptId, storeId },
          include: {
            supplier: { select: { id: true, name: true } },
            createdByUser: { select: { id: true, name: true } },
            details: {
              include: { medicine: { select: { id: true, name: true, baseUnitName: true } } },
            },
          },
        });
        if (!draft) throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy phiếu nhập');
        if (draft.status !== 'draft') {
          throw new ApiError(httpStatus.CONFLICT, 'Chỉ phiếu nháp mới có thể hoàn tất');
        }

        const changed = await tx.importReceipt.updateMany({
          where: { id: receiptId, storeId, status: 'draft' },
          data: { status: 'completed' },
        });
        if (changed.count !== 1) {
          throw new ApiError(httpStatus.CONFLICT, 'Phiếu nhập đã được xử lý bởi yêu cầu khác');
        }

        for (const detail of draft.details) {
          await receiveImportDetail(tx, actor, storeId, draft.id, detail);
        }

        // Selling prices set on the receipt take effect only now, together with the new stock.
        const newPrices = new Map(
          draft.details.flatMap((detail) =>
            detail.newSellingPrice === null ? [] : [[detail.medicineId, detail.newSellingPrice] as const],
          ),
        );
        for (const [medicineId, newSellingPrice] of newPrices) {
          const storeMedicine = await tx.storeMedicine.findUnique({
            where: { storeId_medicineId: { storeId, medicineId } },
            select: { sellingPrice: true },
          });
          if (!storeMedicine || storeMedicine.sellingPrice.equals(newSellingPrice)) continue;
          await tx.storeMedicine.update({
            where: { storeId_medicineId: { storeId, medicineId } },
            data: { sellingPrice: newSellingPrice },
          });
          await writeAudit(tx, actor, {
            storeId,
            action: 'medicine.price_change',
            targetType: 'medicine',
            targetId: medicineId,
            metadata: {
              from: Number(storeMedicine.sellingPrice),
              to: Number(newSellingPrice),
              importReceiptId: draft.id,
            },
          });
        }

        await writeAudit(tx, actor, {
          storeId,
          action: 'import.complete',
          targetType: 'import_receipt',
          targetId: draft.id,
          metadata: { totalAmount: Number(draft.totalAmount), itemCount: draft.details.length },
        });

        return tx.importReceipt.findUniqueOrThrow({
          where: { id: receiptId },
          include: {
            supplier: { select: { id: true, name: true } },
            createdByUser: { select: { id: true, name: true } },
            details: {
              include: { medicine: { select: { id: true, name: true, baseUnitName: true } } },
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return serializeImportReceipt(receipt);
  } catch (error) {
    if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ApiError(httpStatus.CONFLICT, 'Dữ liệu tồn kho vừa thay đổi, vui lòng thử lại');
    }
    throw error;
  }
};

const cancelImportReceipt = async (actor: Actor, storeId: string, receiptId: string) => {
  await getStoreOperationAccess(actor, storeId, 'manager');
  return prisma.$transaction(async (tx) => {
    const changed = await tx.importReceipt.updateMany({
      where: { id: receiptId, storeId, status: 'draft' },
      data: { status: 'cancelled' },
    });
    if (changed.count !== 1) {
      throw new ApiError(httpStatus.CONFLICT, 'Chỉ phiếu nháp mới có thể hủy');
    }
    await writeAudit(tx, actor, {
      storeId,
      action: 'import.cancel',
      targetType: 'import_receipt',
      targetId: receiptId,
    });
    return { message: 'Đã hủy phiếu nhập' };
  });
};

const queryInventory = async (actor: Actor, storeId: string, query: PageQuery & { alert?: 'low' | 'expiring' }) => {
  const access = await getStoreAccess(actor, storeId, 'staff');
  const { page, limit } = getPagination(query);
  let rows = await buildInventoryRows(storeId, query.search);
  if (query.alert === 'low') rows = rows.filter((item) => item.isLowStock);
  if (query.alert === 'expiring') rows = rows.filter((item) => item.hasExpiringBatch);
  const canViewCosts = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';
  return paginateRows(canViewCosts ? rows : hideInventoryCosts(rows), page, limit);
};

const queryInventoryMovements = async (actor: Actor, storeId: string, query: DateQuery) => {
  await getStoreAccess(actor, storeId, 'manager');
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InventoryMovementWhereInput = {
    storeId,
    ...(query.from || query.to ? { createdAt: getDateRange(query) } : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        medicine: { select: { id: true, name: true, baseUnitName: true } },
        stockBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
        createdByUser: { select: { id: true, name: true } },
      },
    }),
  ]);
  return {
    results: results.map((movement) => ({
      ...movement,
      quantityDelta: Number(movement.quantityDelta),
    })),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const querySales = async (actor: Actor, storeId: string, query: DateQuery) => {
  const access = await getStoreAccess(actor, storeId, 'staff');
  const canViewCosts = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.SaleWhereInput = {
    storeId,
    ...(!access.user.isSystemAdmin && access.role === 'staff' ? { soldBy: actor.id } : {}),
    ...(query.from || query.to ? { soldAt: getDateRange(query) } : {}),
  };
  const [totalResults, results] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { soldAt: 'desc' },
      skip,
      take: limit,
      include: {
        soldByUser: { select: { id: true, name: true } },
        details: {
          include: {
            medicine: { select: { id: true, name: true, baseUnitName: true } },
            stockBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
        returns: saleReturnsInclude,
      },
    }),
  ]);
  return {
    results: results.map((sale) => serializeSale(sale, canViewCosts)),
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const getSale = async (actor: Actor, storeId: string, saleId: string) => {
  const access = await getStoreAccess(actor, storeId, 'staff');
  const canViewCosts = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';
  const sale = await prisma.sale.findFirst({
    where: {
      id: saleId,
      storeId,
      ...(!access.user.isSystemAdmin && access.role === 'staff' ? { soldBy: actor.id } : {}),
    },
    include: {
      store: { select: { id: true, name: true, address: true, phone: true } },
      soldByUser: { select: { id: true, name: true } },
      details: {
        include: {
          medicine: { select: { id: true, name: true, baseUnitName: true } },
          stockBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
        },
      },
      returns: saleReturnsInclude,
    },
  });
  if (!sale) throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy đơn bán');
  return serializeSale(sale, canViewCosts);
};

const createSale = async (actor: Actor, storeId: string, body: SalePayload) => {
  const access = await getStoreOperationAccess(actor, storeId, 'staff');
  const canViewCosts = access.user.isSystemAdmin || access.role === 'owner' || access.role === 'manager';
  const medicineIds = body.items.map((item) => item.medicineId);
  if (new Set(medicineIds).size !== medicineIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Mỗi thuốc chỉ được xuất hiện một lần trong đơn');
  }

  try {
    const sale = await prisma.$transaction(
      async (tx) => {
        const storeMedicines = await tx.storeMedicine.findMany({
          where: {
            storeId,
            medicineId: { in: medicineIds },
            isActive: true,
            medicine: { isActive: true },
          },
          include: { medicine: { include: { units: true } } },
        });
        if (storeMedicines.length !== medicineIds.length) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Có thuốc không còn được bán tại quầy');
        }

        const itemByMedicine = new Map(body.items.map((item) => [item.medicineId, item]));
        const resolvedItems = new Map<
          string,
          {
            quantity: Prisma.Decimal;
            unit: (typeof storeMedicines)[number]['medicine']['units'][number];
          }
        >();
        let grossAmount = new PrismaRuntime.Decimal(0);
        const changedPrices: string[] = [];
        for (const configured of storeMedicines) {
          const item = itemByMedicine.get(configured.medicineId);
          if (!item) continue;
          const unit = item.unitId
            ? configured.medicine.units.find((candidate) => candidate.id === item.unitId)
            : configured.medicine.units.find((candidate) => candidate.isBaseUnit);
          if (!unit) throw new ApiError(httpStatus.BAD_REQUEST, `Đơn vị bán không hợp lệ cho ${configured.medicine.name}`);
          const quantity = toDecimal(item.quantity).mul(unit.conversionRate);
          if (quantity.decimalPlaces() > 2) {
            throw new ApiError(httpStatus.BAD_REQUEST, 'Số lượng sau quy đổi chỉ được có tối đa 2 chữ số thập phân');
          }
          resolvedItems.set(configured.medicineId, { quantity, unit });
          grossAmount = grossAmount.plus(configured.sellingPrice.mul(quantity));
          // The cashier quoted the price on screen; never charge a price that changed after the cart was built.
          const currentUnitPrice = configured.sellingPrice.mul(unit.conversionRate);
          if (item.expectedUnitPrice !== undefined && !currentUnitPrice.equals(toDecimal(item.expectedUnitPrice))) {
            changedPrices.push(
              `${configured.medicine.name} (${formatVnd(toDecimal(item.expectedUnitPrice))} → ${formatVnd(currentUnitPrice)}/${unit.name.toLowerCase()})`,
            );
          }
        }
        if (changedPrices.length) {
          throw new ApiError(
            httpStatus.CONFLICT,
            `Giá bán đã thay đổi: ${changedPrices.join(', ')}. Vui lòng báo lại khách và thanh toán lại.`,
          );
        }

        const discountAmount = toDecimal(body.discountAmount ?? 0);
        if (discountAmount.gt(grossAmount)) {
          throw new ApiError(httpStatus.BAD_REQUEST, 'Giảm giá không được lớn hơn tiền hàng');
        }

        const created = await tx.sale.create({
          data: {
            storeId,
            soldBy: actor.id,
            paymentMethod: body.paymentMethod,
            discountAmount,
            totalAmount: grossAmount.minus(discountAmount),
            note: asOptionalString(body.note),
          },
        });

        const today = currentBusinessDateOnly();
        const detailRows: Prisma.SaleDetailCreateManyInput[] = [];
        const movementRows: Prisma.InventoryMovementCreateManyInput[] = [];

        for (const configured of storeMedicines) {
          const resolved = resolvedItems.get(configured.medicineId);
          if (!resolved) continue;
          let remaining = resolved.quantity;
          const batches = await tx.stockBatch.findMany({
            where: {
              storeId,
              medicineId: configured.medicineId,
              quantityRemaining: { gt: 0 },
              expiryDate: { gte: today },
            },
            orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
          });

          for (const batch of batches) {
            if (remaining.lte(0)) break;
            const take = batch.quantityRemaining.lt(remaining) ? batch.quantityRemaining : remaining;
            const changed = await tx.stockBatch.updateMany({
              where: {
                id: batch.id,
                storeId,
                medicineId: configured.medicineId,
                quantityRemaining: { gte: take },
              },
              data: { quantityRemaining: { decrement: take } },
            });
            if (changed.count !== 1) {
              throw new ApiError(httpStatus.CONFLICT, 'Tồn kho vừa thay đổi, vui lòng thử lại');
            }

            detailRows.push({
              saleId: created.id,
              storeId,
              medicineId: configured.medicineId,
              stockBatchId: batch.id,
              quantity: take,
              salePrice: configured.sellingPrice,
              costPrice: batch.importPrice,
              unitNameSnapshot: resolved.unit.name,
              conversionRateSnapshot: resolved.unit.conversionRate,
            });
            movementRows.push({
              storeId,
              medicineId: configured.medicineId,
              stockBatchId: batch.id,
              type: 'sale',
              quantityDelta: take.negated(),
              referenceType: 'sale',
              referenceId: created.id,
              createdBy: actor.id,
            });
            remaining = remaining.minus(take);
          }

          if (remaining.gt(0)) {
            throw new ApiError(httpStatus.CONFLICT, `Không đủ tồn khả dụng cho thuốc ${configured.medicine.name}`);
          }
        }

        await tx.saleDetail.createMany({ data: detailRows });
        await tx.inventoryMovement.createMany({ data: movementRows });
        await writeAudit(tx, actor, {
          storeId,
          action: 'sale.complete',
          targetType: 'sale',
          targetId: created.id,
          metadata: {
            totalAmount: Number(created.totalAmount),
            discountAmount: Number(created.discountAmount),
            medicineCount: body.items.length,
          },
        });

        return tx.sale.findUniqueOrThrow({
          where: { id: created.id },
          include: {
            store: { select: { id: true, name: true, address: true, phone: true } },
            soldByUser: { select: { id: true, name: true } },
            details: {
              include: {
                medicine: { select: { id: true, name: true, baseUnitName: true } },
                stockBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
              },
            },
          },
        });
      },
      { isolationLevel: 'Serializable' },
    );
    return serializeSale(sale, canViewCosts);
  } catch (error) {
    if (error instanceof PrismaRuntime.PrismaClientKnownRequestError && error.code === 'P2034') {
      throw new ApiError(httpStatus.CONFLICT, 'Tồn kho vừa thay đổi, vui lòng thử lại');
    }
    throw error;
  }
};

const createSaleReturn = async (actor: Actor, storeId: string, saleId: string, body: SaleReturnPayload) => {
  await getStoreOperationAccess(actor, storeId, 'manager');
  const detailIds = body.items.map((item) => item.saleDetailId);
  if (new Set(detailIds).size !== detailIds.length) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Mỗi dòng hàng chỉ được xuất hiện một lần trong phiếu trả');
  }

  const sale = await prisma.$transaction(async (tx) => {
    // Serialize returns per sale so refund totals and the refunded status stay consistent.
    await tx.$queryRaw`SELECT id FROM sales WHERE id = ${saleId}::uuid AND store_id = ${storeId}::uuid FOR UPDATE`;
    const current = await tx.sale.findFirst({ where: { id: saleId, storeId }, include: { details: true } });
    if (!current) throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy đơn bán');
    if (current.status !== 'completed') {
      throw new ApiError(httpStatus.CONFLICT, 'Đơn bán đã được trả hết hoặc đã bị hủy');
    }

    // The sale discount is spread over lines pro rata; rounding is applied to the cumulative refund per line.
    const grossAmount = current.details.reduce(
      (sum, detail) => sum.plus(detail.salePrice.mul(detail.quantity)),
      new PrismaRuntime.Decimal(0),
    );
    const refundRatio = grossAmount.gt(0) ? current.totalAmount.div(grossAmount) : new PrismaRuntime.Decimal(0);
    const refundedUpTo = (detail: (typeof current.details)[number], quantity: Prisma.Decimal) =>
      detail.salePrice.mul(quantity).mul(refundRatio).toDecimalPlaces(2, PrismaRuntime.Decimal.ROUND_HALF_UP);

    const lines = body.items.map((item) => {
      const detail = current.details.find((candidate) => candidate.id === item.saleDetailId);
      if (!detail) throw new ApiError(httpStatus.BAD_REQUEST, 'Dòng hàng không thuộc đơn bán này');
      const quantity = toDecimal(item.quantity).mul(detail.conversionRateSnapshot);
      if (quantity.decimalPlaces() > 2) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Số lượng sau quy đổi chỉ được có tối đa 2 chữ số thập phân');
      }
      if (quantity.gt(detail.quantity.minus(detail.returnedQuantity))) {
        throw new ApiError(httpStatus.CONFLICT, 'Số lượng trả vượt quá số lượng còn có thể trả');
      }
      return {
        detail,
        quantity,
        refundAmount: refundedUpTo(detail, detail.returnedQuantity.plus(quantity)).minus(
          refundedUpTo(detail, detail.returnedQuantity),
        ),
      };
    });

    const returningNow = new Map(lines.map((line) => [line.detail.id, line.quantity]));
    const fullyReturned = current.details.every((detail) =>
      detail.returnedQuantity.plus(returningNow.get(detail.id) ?? 0).equals(detail.quantity),
    );
    if (fullyReturned) {
      // Refunds across all returns must add up to the amount the customer paid.
      const previous = await tx.saleReturn.aggregate({ where: { saleId, storeId }, _sum: { refundAmount: true } });
      const thisReturn = lines.reduce((sum, line) => sum.plus(line.refundAmount), new PrismaRuntime.Decimal(0));
      const remainder = current.totalAmount.minus(previous._sum.refundAmount ?? 0).minus(thisReturn);
      const largest = lines.reduce((best, line) => (line.refundAmount.gt(best.refundAmount) ? line : best));
      largest.refundAmount = largest.refundAmount.plus(remainder);
    }

    for (const line of lines) {
      const returned = await tx.saleDetail.updateMany({
        where: {
          id: line.detail.id,
          saleId,
          storeId,
          returnedQuantity: { lte: line.detail.quantity.minus(line.quantity) },
        },
        data: { returnedQuantity: { increment: line.quantity } },
      });
      const restocked = await tx.stockBatch.updateMany({
        where: { id: line.detail.stockBatchId, storeId, medicineId: line.detail.medicineId },
        data: { quantityRemaining: { increment: line.quantity } },
      });
      if (returned.count !== 1 || restocked.count !== 1) {
        throw new ApiError(httpStatus.CONFLICT, 'Đơn bán vừa thay đổi, vui lòng tải lại và thử lại');
      }
    }

    const refundAmount = lines.reduce((sum, line) => sum.plus(line.refundAmount), new PrismaRuntime.Decimal(0));
    const saleReturn = await tx.saleReturn.create({
      data: {
        storeId,
        saleId,
        createdBy: actor.id,
        refundAmount,
        note: asOptionalString(body.note),
        details: {
          create: lines.map((line) => ({
            saleDetailId: line.detail.id,
            quantity: line.quantity,
            refundAmount: line.refundAmount,
          })),
        },
      },
    });
    await tx.inventoryMovement.createMany({
      data: lines.map((line) => ({
        storeId,
        medicineId: line.detail.medicineId,
        stockBatchId: line.detail.stockBatchId,
        type: 'return' as const,
        quantityDelta: line.quantity,
        referenceType: 'sale_return' as const,
        referenceId: saleReturn.id,
        createdBy: actor.id,
      })),
    });
    if (fullyReturned) {
      await tx.sale.update({ where: { id: saleId }, data: { status: 'refunded' } });
    }
    await writeAudit(tx, actor, {
      storeId,
      action: 'sale.return',
      targetType: 'sale',
      targetId: saleId,
      metadata: {
        saleReturnId: saleReturn.id,
        refundAmount: Number(refundAmount),
        itemCount: lines.length,
        saleRefunded: fullyReturned,
      },
    });

    return tx.sale.findUniqueOrThrow({
      where: { id: saleId },
      include: {
        store: { select: { id: true, name: true, address: true, phone: true } },
        soldByUser: { select: { id: true, name: true } },
        details: {
          include: {
            medicine: { select: { id: true, name: true, baseUnitName: true } },
            stockBatch: { select: { id: true, batchNumber: true, expiryDate: true } },
          },
        },
        returns: saleReturnsInclude,
      },
    });
  });
  return serializeSale(sale, true);
};

const getProfitReport = async (actor: Actor, storeId: string, query: DateQuery) => {
  await getStoreAccess(actor, storeId, 'manager');
  const range = query.from || query.to ? getDateRange(query) : undefined;
  const returns = await queryReturnsForReport(storeId, range);
  const sales = await prisma.sale.findMany({
    where: {
      storeId,
      status: { in: ['completed', 'refunded'] },
      ...(query.from || query.to ? { soldAt: getDateRange(query) } : {}),
    },
    orderBy: { soldAt: 'asc' },
    include: {
      details: {
        include: {
          medicine: { select: { id: true, name: true, baseUnitName: true } },
        },
      },
    },
  });

  let revenue = new PrismaRuntime.Decimal(0);
  let cost = new PrismaRuntime.Decimal(0);
  const series = new Map<string, { revenue: Prisma.Decimal; cost: Prisma.Decimal; orders: number }>();
  const medicineTotals = new Map<
    string,
    { id: string; name: string; unit: string; quantity: Prisma.Decimal; revenue: Prisma.Decimal; cost: Prisma.Decimal }
  >();

  for (const sale of sales) {
    const saleCost = sale.details.reduce(
      (sum, detail) => sum.plus(detail.costPrice.mul(detail.quantity)),
      new PrismaRuntime.Decimal(0),
    );
    const saleGrossBeforeDiscount = sale.details.reduce(
      (sum, detail) => sum.plus(detail.salePrice.mul(detail.quantity)),
      new PrismaRuntime.Decimal(0),
    );
    const revenueRatio = saleGrossBeforeDiscount.gt(0)
      ? sale.totalAmount.div(saleGrossBeforeDiscount)
      : new PrismaRuntime.Decimal(0);
    revenue = revenue.plus(sale.totalAmount);
    cost = cost.plus(saleCost);

    const date = toBusinessDateKey(sale.soldAt);
    const day = series.get(date) ?? {
      revenue: new PrismaRuntime.Decimal(0),
      cost: new PrismaRuntime.Decimal(0),
      orders: 0,
    };
    day.revenue = day.revenue.plus(sale.totalAmount);
    day.cost = day.cost.plus(saleCost);
    if (sale.status === 'completed') day.orders += 1;
    series.set(date, day);

    for (const detail of sale.details) {
      const current = medicineTotals.get(detail.medicineId) ?? {
        id: detail.medicineId,
        name: detail.medicine.name,
        unit: detail.medicine.baseUnitName,
        quantity: new PrismaRuntime.Decimal(0),
        revenue: new PrismaRuntime.Decimal(0),
        cost: new PrismaRuntime.Decimal(0),
      };
      const detailRevenue = detail.salePrice.mul(detail.quantity).mul(revenueRatio);
      current.quantity = current.quantity.plus(detail.quantity);
      current.revenue = current.revenue.plus(detailRevenue);
      current.cost = current.cost.plus(detail.costPrice.mul(detail.quantity));
      medicineTotals.set(detail.medicineId, current);
    }
  }

  for (const saleReturn of returns) {
    const returnedCost = saleReturn.details.reduce(
      (sum, detail) => sum.plus(detail.saleDetail.costPrice.mul(detail.quantity)),
      new PrismaRuntime.Decimal(0),
    );
    revenue = revenue.minus(saleReturn.refundAmount);
    cost = cost.minus(returnedCost);

    const date = toBusinessDateKey(saleReturn.createdAt);
    const day = series.get(date) ?? {
      revenue: new PrismaRuntime.Decimal(0),
      cost: new PrismaRuntime.Decimal(0),
      orders: 0,
    };
    day.revenue = day.revenue.minus(saleReturn.refundAmount);
    day.cost = day.cost.minus(returnedCost);
    series.set(date, day);

    for (const detail of saleReturn.details) {
      const { medicine, medicineId, costPrice } = detail.saleDetail;
      const current = medicineTotals.get(medicineId) ?? {
        id: medicineId,
        name: medicine.name,
        unit: medicine.baseUnitName,
        quantity: new PrismaRuntime.Decimal(0),
        revenue: new PrismaRuntime.Decimal(0),
        cost: new PrismaRuntime.Decimal(0),
      };
      current.quantity = current.quantity.minus(detail.quantity);
      current.revenue = current.revenue.minus(detail.refundAmount);
      current.cost = current.cost.minus(costPrice.mul(detail.quantity));
      medicineTotals.set(medicineId, current);
    }
  }

  const inventoryRows = await buildInventoryRows(storeId);
  return {
    totals: {
      revenue: Number(revenue),
      cost: Number(cost),
      grossProfit: Number(revenue.minus(cost)),
      orders: sales.filter((sale) => sale.status === 'completed').length,
      inventoryValue: inventoryRows.reduce((sum, item) => sum + item.inventoryValue, 0),
    },
    series: [...series.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, item]) => ({
        date,
        revenue: Number(item.revenue),
        cost: Number(item.cost),
        grossProfit: Number(item.revenue.minus(item.cost)),
        orders: item.orders,
      })),
    topMedicines: [...medicineTotals.values()]
      .sort((left, right) => Number(right.revenue.minus(right.cost).minus(left.revenue.minus(left.cost))))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        quantity: Number(item.quantity),
        revenue: Number(item.revenue),
        cost: Number(item.cost),
        grossProfit: Number(item.revenue.minus(item.cost)),
      })),
  };
};

export {
  cancelImportReceipt,
  completeImportReceipt,
  createImportReceipt,
  createMedicine,
  createProductCategory,
  createSale,
  createSaleReturn,
  createSupplier,
  getContext,
  getDashboard,
  getImportReceipt,
  getProfitReport,
  getSale,
  generateMedicineCode,
  queryImportReceipts,
  queryInventory,
  queryInventoryMovements,
  queryMedicines,
  queryProductCategories,
  queryReferenceProducts,
  querySales,
  querySuppliers,
  updateMedicine,
  updateProductCategory,
  updateSupplier,
};
