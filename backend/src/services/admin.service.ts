import bcrypt from 'bcryptjs';
import httpStatus from 'http-status';
import type { Prisma, StoreRole } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';

const STORE_ROLES: StoreRole[] = ['owner', 'manager', 'staff'];

type Actor = Express.User;

type PageOptions = {
  page?: string | number;
  limit?: string | number;
};

const getPagination = (options: PageOptions) => {
  const limit = Number(options.limit) > 0 ? Math.min(Number(options.limit), 100) : 10;
  const page = Number(options.page) > 0 ? Number(options.page) : 1;
  return { limit, page, skip: (page - 1) * limit };
};

const paginate = async <T>(
  countQuery: Prisma.PrismaPromise<number>,
  rowsQuery: Prisma.PrismaPromise<T[]>,
  page: number,
  limit: number,
) => {
  const [totalResults, results] = await prisma.$transaction([countQuery, rowsQuery]);
  return {
    results,
    page,
    limit,
    totalPages: Math.ceil(totalResults / limit),
    totalResults,
  };
};

const getActorWithRoles = async (actor: Actor) => {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: {
      storeRoles: {
        include: {
          store: {
            select: { id: true, name: true, isActive: true },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'User is inactive');
  }

  return user;
};

const ensureAdminPanelAccess = async (actor: Actor) => {
  const user = await getActorWithRoles(actor);
  const hasStoreAdminRole = user.storeRoles.some((role) => role.role === 'owner' || role.role === 'manager');
  if (!user.isSystemAdmin && !hasStoreAdminRole) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Staff cannot access admin panel');
  }
  return user;
};

const listScopedStoreIds = async (actor: Actor, roles: StoreRole[] = ['owner', 'manager']) => {
  const user = await ensureAdminPanelAccess(actor);
  if (user.isSystemAdmin) {
    const stores = await prisma.store.findMany({ select: { id: true } });
    return stores.map((store) => store.id);
  }

  return user.storeRoles.filter((role) => roles.includes(role.role)).map((role) => role.storeId);
};

const assertSystemAdmin = async (actor: Actor) => {
  const user = await getActorWithRoles(actor);
  if (!user.isSystemAdmin) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Only system admin can perform this action');
  }
  return user;
};

const assertCanManageStore = async (actor: Actor, storeId: string, roles: StoreRole[] = ['owner', 'manager']) => {
  const user = await ensureAdminPanelAccess(actor);
  if (user.isSystemAdmin) return user;

  const allowed = user.storeRoles.some((role) => role.storeId === storeId && roles.includes(role.role));
  if (!allowed) {
    throw new ApiError(httpStatus.FORBIDDEN, 'You do not have permission for this store');
  }
  return user;
};

const assertCanAssignRole = async (actor: Actor, storeId: string, role: StoreRole) => {
  const user = await assertCanManageStore(actor, storeId, ['owner', 'manager']);
  if (user.isSystemAdmin) return user;

  const actorRole = user.storeRoles.find((storeRole) => storeRole.storeId === storeId && storeRole.role !== 'staff')?.role;
  if (actorRole === 'owner' && (role === 'manager' || role === 'staff')) return user;
  if (actorRole === 'manager' && role === 'staff') return user;

  throw new ApiError(httpStatus.FORBIDDEN, 'You cannot assign this role');
};

const audit = async ({
  actor,
  storeId,
  action,
  targetType,
  targetId,
  metadata,
}: {
  actor: Actor;
  storeId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
}) => {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      storeId: storeId ?? null,
      action,
      targetType,
      targetId: targetId ?? null,
      metadata: metadata ?? undefined,
    },
  });
};

const getAdminContext = async (actor: Actor) => {
  const user = await ensureAdminPanelAccess(actor);
  const stores = user.isSystemAdmin
    ? await prisma.store.findMany({ orderBy: { name: 'asc' } })
    : user.storeRoles.map((role) => ({
        ...role.store,
        role: role.role,
      }));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      isSystemAdmin: user.isSystemAdmin,
      roles: user.storeRoles.map((role) => ({
        storeId: role.storeId,
        storeName: role.store.name,
        role: role.role,
      })),
    },
    stores,
  };
};

const getDashboard = async (actor: Actor) => {
  const storeIds = await listScopedStoreIds(actor);
  const whereStore: Prisma.StoreWhereInput = actor.isSystemAdmin ? {} : { id: { in: storeIds } };
  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 30);

  const [storeCount, activeUserCount, medicineCount, summary] = await prisma.$transaction([
    prisma.store.count({ where: { ...whereStore, isActive: true } }),
    prisma.user.count({
      where: actor.isSystemAdmin
        ? { isActive: true }
        : { isActive: true, storeRoles: { some: { storeId: { in: storeIds } } } },
    }),
    prisma.medicine.count({ where: { isActive: true } }),
    prisma.dailyProfitSummary.aggregate({
      where: {
        ...(actor.isSystemAdmin ? {} : { storeId: { in: storeIds } }),
        summaryDate: { gte: from, lte: today },
      },
      _sum: {
        totalRevenue: true,
        totalCost: true,
        totalProfit: true,
        totalOrders: true,
      },
    }),
  ]);

  return {
    storeCount,
    activeUserCount,
    medicineCount,
    revenue30Days: Number(summary._sum.totalRevenue ?? 0),
    cost30Days: Number(summary._sum.totalCost ?? 0),
    profit30Days: Number(summary._sum.totalProfit ?? 0),
    orders30Days: Number(summary._sum.totalOrders ?? 0),
  };
};

const queryStores = async (actor: Actor, query) => {
  const { page, limit, skip } = getPagination(query);
  const scopedStoreIds = await listScopedStoreIds(actor);
  const where: Prisma.StoreWhereInput = {
    ...(actor.isSystemAdmin ? {} : { id: { in: scopedStoreIds } }),
    ...(query.search ? { name: { contains: query.search, mode: 'insensitive' } } : {}),
  };

  return paginate(
    prisma.store.count({ where }),
    prisma.store.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: {
        _count: { select: { roles: true } },
      },
    }),
    page,
    limit,
  );
};

const createStore = async (actor: Actor, body) => {
  await assertSystemAdmin(actor);

  const result = await prisma.$transaction(async (tx) => {
    const store = await tx.store.create({
      data: {
        name: body.name,
        address: body.address,
        phone: body.phone,
      },
    });

    let owner = null;
    if (body.owner) {
      const existing = await tx.user.findFirst({ where: { email: body.owner.email } });
      if (existing) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Owner email already taken');
      }

      owner = await tx.user.create({
        data: {
          name: body.owner.name,
          email: body.owner.email,
          phone: body.owner.phone,
          password: await bcrypt.hash(body.owner.password, 8),
          isEmailVerified: true,
        },
      });

      await tx.userStoreRole.create({
        data: {
          userId: owner.id,
          storeId: store.id,
          role: 'owner',
        },
      });
    }

    return { store, owner };
  });

  await audit({
    actor,
    storeId: result.store.id,
    action: 'store.create',
    targetType: 'store',
    targetId: result.store.id,
    metadata: { ownerId: result.owner?.id ?? null },
  });

  return result;
};

const updateStore = async (actor: Actor, storeId: string, body) => {
  await assertSystemAdmin(actor);
  const store = await prisma.store.update({
    where: { id: storeId },
    data: {
      name: body.name,
      address: body.address,
      phone: body.phone,
      isActive: body.isActive,
    },
  });

  await audit({
    actor,
    storeId,
    action: 'store.update',
    targetType: 'store',
    targetId: storeId,
    metadata: body,
  });

  return store;
};

const queryAdminUsers = async (actor: Actor, query) => {
  const { page, limit, skip } = getPagination(query);
  const storeIds = query.storeId ? [query.storeId] : await listScopedStoreIds(actor);
  if (query.storeId) {
    await assertCanManageStore(actor, query.storeId, ['owner', 'manager']);
  }

  const where: Prisma.UserWhereInput = {
    ...(actor.isSystemAdmin && !query.storeId ? {} : { storeRoles: { some: { storeId: { in: storeIds } } } }),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { email: { contains: query.search, mode: 'insensitive' } },
            { phone: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  return paginate(
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        isActive: true,
        isSystemAdmin: true,
        storeRoles: {
          where: query.storeId ? { storeId: query.storeId } : undefined,
          include: { store: { select: { id: true, name: true } } },
        },
      },
    }),
    page,
    limit,
  );
};

const createAdminUser = async (actor: Actor, body) => {
  if (!STORE_ROLES.includes(body.storeRole)) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Invalid store role');
  }
  await assertCanAssignRole(actor, body.storeId, body.storeRole);

  const existing = await prisma.user.findFirst({ where: { email: body.email } });
  if (existing) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Email already taken');
  }

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        password: await bcrypt.hash(body.password, 8),
        isEmailVerified: true,
      },
    });

    await tx.userStoreRole.create({
      data: {
        userId: created.id,
        storeId: body.storeId,
        role: body.storeRole,
      },
    });

    return created;
  });

  await audit({
    actor,
    storeId: body.storeId,
    action: 'user.create',
    targetType: 'user',
    targetId: user.id,
    metadata: { storeRole: body.storeRole },
  });

  return user;
};

const updateAdminUser = async (actor: Actor, userId: string, body) => {
  if (body.storeId) {
    await assertCanManageStore(actor, body.storeId, ['owner', 'manager']);
  } else if (!actor.isSystemAdmin) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'storeId is required');
  }

  if (body.storeRole) {
    await assertCanAssignRole(actor, body.storeId, body.storeRole);
  }

  const user = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        isActive: body.isActive,
        password: body.password ? await bcrypt.hash(body.password, 8) : undefined,
      },
    });

    if (body.storeId && body.storeRole) {
      await tx.userStoreRole.deleteMany({ where: { userId, storeId: body.storeId } });
      await tx.userStoreRole.create({ data: { userId, storeId: body.storeId, role: body.storeRole } });
    }

    return updated;
  });

  await audit({
    actor,
    storeId: body.storeId,
    action: body.isActive === false ? 'user.lock' : 'user.update',
    targetType: 'user',
    targetId: userId,
    metadata: { storeRole: body.storeRole ?? null },
  });

  return user;
};

const resetUserPassword = async (actor: Actor, userId: string, body) => {
  const targetRole = await prisma.userStoreRole.findFirst({ where: { userId, storeId: body.storeId } });
  if (!targetRole) {
    throw new ApiError(httpStatus.NOT_FOUND, 'User is not assigned to this store');
  }
  await assertCanAssignRole(actor, body.storeId, targetRole.role);

  await prisma.user.update({
    where: { id: userId },
    data: { password: await bcrypt.hash(body.password, 8) },
  });

  await audit({
    actor,
    storeId: body.storeId,
    action: 'user.reset_password',
    targetType: 'user',
    targetId: userId,
  });

  return { message: 'Password has been reset' };
};

const validateMedicineUnits = (baseUnitName: string, units = []) => {
  const normalizedUnits = units.length ? units : [{ name: baseUnitName, conversionRate: 1, isBaseUnit: true }];
  const baseUnits = normalizedUnits.filter((unit) => unit.isBaseUnit);
  if (baseUnits.length !== 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Medicine must have exactly one base unit');
  }
  if (baseUnits[0].name !== baseUnitName || Number(baseUnits[0].conversionRate) !== 1) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Base unit must match baseUnitName and have conversion rate 1');
  }
  return normalizedUnits;
};

const queryMedicines = async (query) => {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.MedicineWhereInput = {
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' } },
            { barcode: { contains: query.search, mode: 'insensitive' } },
            { category: { contains: query.search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  return paginate(
    prisma.medicine.count({ where }),
    prisma.medicine.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { units: { orderBy: { isBaseUnit: 'desc' } } },
    }),
    page,
    limit,
  );
};

const createMedicine = async (actor: Actor, body) => {
  await ensureAdminPanelAccess(actor);
  const units = validateMedicineUnits(body.baseUnitName, body.units);

  const medicine = await prisma.medicine.create({
    data: {
      name: body.name,
      baseUnitName: body.baseUnitName,
      barcode: body.barcode,
      registrationNumber: body.registrationNumber,
      category: body.category,
      activeIngredient: body.activeIngredient,
      strength: body.strength,
      dosageForm: body.dosageForm,
      manufacturer: body.manufacturer,
      requiresPrescription: body.requiresPrescription ?? false,
      description: body.description,
      units: {
        create: units.map((unit) => ({
          name: unit.name,
          conversionRate: unit.conversionRate,
          isBaseUnit: unit.isBaseUnit,
        })),
      },
    },
    include: { units: true },
  });

  await audit({ actor, action: 'medicine.create', targetType: 'medicine', targetId: medicine.id });
  return medicine;
};

const updateMedicine = async (actor: Actor, medicineId: string, body) => {
  await ensureAdminPanelAccess(actor);
  const units = body.units ? validateMedicineUnits(body.baseUnitName, body.units) : null;

  const medicine = await prisma.$transaction(async (tx) => {
    const updated = await tx.medicine.update({
      where: { id: medicineId },
      data: {
        name: body.name,
        baseUnitName: body.baseUnitName,
        barcode: body.barcode,
        registrationNumber: body.registrationNumber,
        category: body.category,
        activeIngredient: body.activeIngredient,
        strength: body.strength,
        dosageForm: body.dosageForm,
        manufacturer: body.manufacturer,
        requiresPrescription: body.requiresPrescription,
        description: body.description,
        isActive: body.isActive,
      },
    });

    if (units) {
      await tx.medicineUnit.deleteMany({ where: { medicineId } });
      await tx.medicineUnit.createMany({
        data: units.map((unit) => ({
          medicineId,
          name: unit.name,
          conversionRate: unit.conversionRate,
          isBaseUnit: unit.isBaseUnit,
        })),
      });
    }

    return updated;
  });

  await audit({ actor, action: 'medicine.update', targetType: 'medicine', targetId: medicineId, metadata: body });
  return prisma.medicine.findUnique({ where: { id: medicine.id }, include: { units: true } });
};

const queryImportReceipts = async (actor: Actor, query) => {
  const { page, limit, skip } = getPagination(query);
  const scopedStoreIds = query.storeId ? [query.storeId] : await listScopedStoreIds(actor);
  if (query.storeId) await assertCanManageStore(actor, query.storeId);

  const where: Prisma.ImportReceiptWhereInput = {
    storeId: { in: actor.isSystemAdmin && !query.storeId ? scopedStoreIds : scopedStoreIds },
    ...(query.from || query.to
      ? {
          importedAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        }
      : {}),
  };

  return paginate(
    prisma.importReceipt.count({ where }),
    prisma.importReceipt.findMany({
      where,
      orderBy: { importedAt: 'desc' },
      skip,
      take: limit,
      include: {
        store: { select: { id: true, name: true } },
        createdByUser: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
        details: { include: { medicine: { select: { id: true, name: true, baseUnitName: true } } } },
      },
    }),
    page,
    limit,
  );
};

const querySales = async (actor: Actor, query) => {
  const { page, limit, skip } = getPagination(query);
  const scopedStoreIds = query.storeId ? [query.storeId] : await listScopedStoreIds(actor);
  if (query.storeId) await assertCanManageStore(actor, query.storeId);

  const where: Prisma.SaleWhereInput = {
    storeId: { in: scopedStoreIds },
    ...(query.from || query.to
      ? {
          soldAt: { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) },
        }
      : {}),
  };

  return paginate(
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { soldAt: 'desc' },
      skip,
      take: limit,
      include: {
        store: { select: { id: true, name: true } },
        soldByUser: { select: { id: true, name: true } },
        details: { include: { medicine: { select: { id: true, name: true, baseUnitName: true } }, stockBatch: true } },
      },
    }),
    page,
    limit,
  );
};

const getProfitReport = async (actor: Actor, query) => {
  const storeIds = query.storeId ? [query.storeId] : await listScopedStoreIds(actor);
  if (query.storeId) await assertCanManageStore(actor, query.storeId);
  const from = query.from ? new Date(query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = query.to ? new Date(query.to) : new Date();

  const rows = await prisma.dailyProfitSummary.findMany({
    where: { storeId: { in: storeIds }, summaryDate: { gte: from, lte: to } },
    orderBy: { summaryDate: 'asc' },
  });

  if (rows.length) {
    return {
      source: 'daily_profit_summary',
      totals: {
        revenue: rows.reduce((sum, row) => sum + Number(row.totalRevenue), 0),
        cost: rows.reduce((sum, row) => sum + Number(row.totalCost), 0),
        profit: rows.reduce((sum, row) => sum + Number(row.totalProfit), 0),
        orders: rows.reduce((sum, row) => sum + row.totalOrders, 0),
      },
      series: rows.map((row) => ({
        date: row.summaryDate,
        revenue: Number(row.totalRevenue),
        profit: Number(row.totalProfit),
      })),
    };
  }

  const sales = await prisma.sale.findMany({
    where: { storeId: { in: storeIds }, soldAt: { gte: from, lte: to } },
    include: { details: true },
    orderBy: { soldAt: 'asc' },
  });

  const totals = sales.reduce(
    (acc, sale) => {
      const cost = sale.details.reduce((sum, detail) => sum + Number(detail.costPrice) * Number(detail.quantity), 0);
      acc.revenue += Number(sale.totalAmount);
      acc.cost += cost;
      acc.profit += Number(sale.totalAmount) - cost;
      acc.orders += 1;
      return acc;
    },
    { revenue: 0, cost: 0, profit: 0, orders: 0 },
  );

  return {
    source: 'sale_details',
    totals,
    series: sales.map((sale) => ({
      date: sale.soldAt,
      revenue: Number(sale.totalAmount),
      profit:
        Number(sale.totalAmount) -
        sale.details.reduce((sum, detail) => sum + Number(detail.costPrice) * Number(detail.quantity), 0),
    })),
  };
};

export {
  createAdminUser,
  createMedicine,
  createStore,
  getAdminContext,
  getDashboard,
  getProfitReport,
  queryAdminUsers,
  queryImportReceipts,
  queryMedicines,
  querySales,
  queryStores,
  resetUserPassword,
  updateAdminUser,
  updateMedicine,
  updateStore,
};
