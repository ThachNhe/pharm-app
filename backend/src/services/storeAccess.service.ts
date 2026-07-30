import httpStatus from 'http-status';
import type { StoreRole } from '../generated/prisma/client.js';
import { prisma } from '../config/database.js';
import ApiError from '../utils/ApiError.js';

const ROLE_RANK: Record<StoreRole, number> = {
  staff: 1,
  manager: 2,
  owner: 3,
};

type Actor = Express.User;

const getActiveActor = async (actor: Actor) => {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: {
      storeRoles: {
        include: {
          store: {
            select: {
              id: true,
              name: true,
              address: true,
              phone: true,
              isActive: true,
            },
          },
        },
      },
    },
  });

  if (!user || !user.isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Tài khoản đã bị khóa hoặc không tồn tại');
  }

  return user;
};

const getStoreAccess = async (actor: Actor, storeId: string, minimumRole: StoreRole = 'staff') => {
  const user = await getActiveActor(actor);
  const membership = user.storeRoles.find((item) => item.storeId === storeId);

  if (user.isSystemAdmin) {
    const store =
      membership?.store ??
      (await prisma.store.findUnique({
        where: { id: storeId },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          isActive: true,
        },
      }));

    if (!store) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Không tìm thấy quầy thuốc');
    }
    if (!store.isActive) {
      throw new ApiError(httpStatus.FORBIDDEN, 'Quầy thuốc đang ngừng hoạt động');
    }

    return { user, store, role: membership?.role ?? null };
  }

  if (!membership || !membership.isActive || !membership.store.isActive) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền truy cập quầy thuốc này');
  }

  if (ROLE_RANK[membership.role] < ROLE_RANK[minimumRole]) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Bạn không có quyền thực hiện thao tác này');
  }

  return { user, store: membership.store, role: membership.role };
};

const getStoreContext = async (actor: Actor) => {
  const user = await getActiveActor(actor);
  const stores = user.isSystemAdmin
    ? await prisma.store.findMany({
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          isActive: true,
        },
      })
    : user.storeRoles
        .filter((membership) => membership.isActive && membership.store.isActive)
        .map((membership) => ({
          ...membership.store,
          role: membership.role,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'vi'));

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      isSystemAdmin: user.isSystemAdmin,
    },
    stores: stores.map((store) => ({
      ...store,
      role:
        'role' in store ? store.role : (user.storeRoles.find((membership) => membership.storeId === store.id)?.role ?? null),
    })),
  };
};

export { getActiveActor, getStoreAccess, getStoreContext, ROLE_RANK };
