import { expect, test, type Page } from '@playwright/test';

type Role = 'owner' | 'manager' | 'staff' | 'system';
const storeId = 'a77d6653-7f76-4d02-a8fd-321736fba492';
const store = {
    id: storeId,
    name: 'Quầy kiểm thử',
    address: 'Địa chỉ kiểm thử',
    phone: '0900000000',
    isActive: true,
};
const unassigned = {
    id: 'unassigned',
    name: 'Chưa gán quầy',
    email: 'unassigned@example.com',
    isActive: true,
    isSystemAdmin: false,
    storeRoles: [],
};
const assigned = {
    ...unassigned,
    id: 'assigned',
    name: 'Nhân viên quầy',
    email: 'staff@store.example.com',
    storeRoles: [
        {
            role: 'staff',
            isActive: true,
            store: { id: storeId, name: store.name },
        },
    ],
};
const supplier = {
    id: 'supplier',
    name: 'Nhà cung cấp kiểm thử',
    isActive: true,
};
const receipt = {
    id: 'receipt',
    status: 'draft',
    totalAmount: 1000,
    createdAt: '2026-09-05T08:00:00Z',
    importedAt: '2026-09-05T08:00:00Z',
    createdByUser: { name: 'Owner' },
    supplier,
    details: [],
};

async function mockWorkspace(page: Page, role: Role, noStores = false) {
    const state = {
        role,
        expired: false,
        contextCalls: 0,
        failedSave: false,
        storePayload: null as Record<string, unknown> | null,
        userPayload: null as Record<string, unknown> | null,
        userSearch: '',
    };
    const user = () => ({
        id: state.role,
        name: state.role,
        email: `${state.role}@example.com`,
        isSystemAdmin: state.role === 'system',
    });
    const session = () => ({
        user: user(),
        tokens: {
            access: {
                token: `test-${state.role}`,
                expires: '2099-01-01T00:00:00Z',
            },
        },
    });
    await page.route('**/*', async (route) => {
        if (route.request().resourceType() === 'document')
            return route.continue();
        const url = new URL(route.request().url());
        const path = url.pathname;
        const reply = (body: unknown, status = 200) =>
            route.fulfill({ status, json: body });
        const list = (results: unknown[]) => ({
            results,
            totalResults: results.length,
            page: 1,
            totalPages: 1,
        });
        if (path.endsWith('/auth/refresh-tokens'))
            return state.expired
                ? reply({ message: 'Expired' }, 401)
                : reply(session());
        if (path.endsWith('/auth/logout')) return reply({});
        if (path.endsWith('/auth/login'))
            return reply({ challengeId: 'test', email: 'staff@example.com' });
        if (path.endsWith('/auth/verify-login-otp')) {
            state.role = 'staff';
            state.expired = false;
            return reply(session());
        }
        if (path.endsWith('/stores/context')) {
            state.contextCalls++;
            return reply({
                user: user(),
                stores: noStores
                    ? []
                    : [
                          {
                              ...store,
                              role: state.role === 'system' ? null : state.role,
                          },
                      ],
            });
        }
        if (path.endsWith('/admin/dashboard'))
            return reply({
                storeCount: 1,
                activeUserCount: 3,
                medicineCount: 2,
                revenue30Days: 987654,
                profit30Days: 987531,
                orders30Days: 1,
            });
        if (path.endsWith(`/${storeId}/dashboard`))
            return reply({
                store,
                today: {
                    revenue: 987654,
                    cost: 123,
                    grossProfit: 987531,
                    orders: 1,
                },
                inventory: {
                    medicineCount: 1,
                    lowStockCount: 0,
                    expiringCount: 0,
                    value: 123,
                },
                supplierCount: 1,
            });
        if (path.endsWith(`/${storeId}/suppliers`))
            return state.expired
                ? reply({ message: 'Expired' }, 401)
                : reply(list([supplier]));
        if (path.endsWith(`/${storeId}/imports`)) return reply(list([receipt]));
        if (
            path.endsWith(`/${storeId}/sales`) ||
            path.endsWith(`/${storeId}/medicines`)
        )
            return reply(list([]));
        if (path.endsWith(`/admin/stores/${storeId}`)) {
            state.storePayload = route.request().postDataJSON();
            return state.failedSave
                ? reply({ message: 'Lưu thất bại' }, 500)
                : reply(store);
        }
        if (path.endsWith('/admin/stores'))
            return reply(list([{ ...store, _count: { roles: 1 } }]));
        if (path.endsWith('/admin/users')) {
            state.userSearch = url.search;
            return reply(
                list(
                    url.searchParams.has('storeId') ? [assigned] : [unassigned]
                )
            );
        }
        if (path.endsWith('/admin/users/unassigned')) {
            state.userPayload = route.request().postDataJSON();
            return reply(unassigned);
        }
        return route.continue();
    });
    return state;
}

test('expired owner session cannot leave cached permissions or finances for a new staff login', async ({
    page,
}) => {
    const state = await mockWorkspace(page, 'owner');
    await page.goto('/admin');
    await expect(
        page.getByText('Lãi gộp hôm nay', { exact: true })
    ).toBeVisible();
    state.expired = true;
    await page.getByRole('link', { name: 'Nhà cung cấp', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.getByLabel('Email', { exact: true }).fill('staff@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('Test1234!');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    await page.getByLabel('Mã xác minh').fill('123456');
    await page.getByRole('button', { name: 'Xác minh', exact: true }).click();
    await expect(
        page.getByRole('heading', { name: 'Tổng quan Quầy kiểm thử' })
    ).toBeVisible();
    expect(state.contextCalls).toBe(2);
    await expect(
        page.getByText('Lãi gộp hôm nay', { exact: true })
    ).toHaveCount(0);
    await expect(
        page.getByRole('link', { name: 'Tài khoản', exact: true })
    ).toHaveCount(0);
    await page.goto('/admin/users');
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();
});

test('system admin has management navigation and cannot enter operational routes', async ({
    page,
}) => {
    await mockWorkspace(page, 'system');
    await page.goto('/admin');
    await expect(
        page.getByRole('heading', { name: 'Tổng quan hệ thống' })
    ).toBeVisible();
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link')).toHaveCount(4);
    for (const path of [
        'sales',
        'imports',
        'inventory',
        'medicines',
        'suppliers',
        'store',
    ]) {
        await page.goto(`/admin/${path}`);
        await expect(
            page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
        ).toBeVisible();
    }
});

test('system admin opens the employee list for a store from the store table', async ({
    page,
}) => {
    await mockWorkspace(page, 'system');
    await page.goto('/admin/stores');
    await page
        .getByRole('link', {
            name: `Xem 1 nhân sự của ${store.name}`,
        })
        .click();

    await expect(page).toHaveURL(
        new RegExp(`/admin/users\\?storeId=${storeId}`)
    );
    await expect(
        page.getByRole('heading', { name: `Nhân sự — ${store.name}` })
    ).toBeVisible();
    const employeeRow = page.getByRole('row', { name: /Nhân viên quầy/ });
    await expect(employeeRow).toContainText(store.name);
    await expect(employeeRow).toContainText('Nhân viên');
    await page.reload();
    await expect(
        page.getByRole('heading', { name: `Nhân sự — ${store.name}` })
    ).toBeVisible();
    await expect(
        page.getByRole('row', { name: /Nhân viên quầy/ })
    ).toContainText(store.name);
    await page.screenshot({
        path: '/tmp/pharm-store-employee-list.png',
        fullPage: true,
        animations: 'disabled',
    });
});

test('owner edits contact details, preserves failed form values, and cannot toggle store status', async ({
    page,
}) => {
    const state = await mockWorkspace(page, 'owner');
    await page.goto('/admin/store');
    await page.getByRole('button', { name: 'Sửa thông tin' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await dialog.getByLabel('Tên quầy thuốc').fill('Quầy đã cập nhật');
    state.failedSave = true;
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(page.getByText('Lưu thất bại', { exact: true })).toBeVisible();
    await expect(dialog.getByLabel('Tên quầy thuốc')).toHaveValue(
        'Quầy đã cập nhật'
    );
    state.failedSave = false;
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.storePayload).toEqual({
        name: 'Quầy đã cập nhật',
        address: store.address,
        phone: store.phone,
    });
    await page.goto('/admin/stores');
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();
});

for (const role of ['staff', 'manager'] as const) {
    test(`${role} supplier and store permissions follow the current role`, async ({
        page,
    }) => {
        await mockWorkspace(page, role);
        await page.goto('/admin/suppliers');
        await expect(
            page.getByText(supplier.name, { exact: true })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Thêm nhà cung cấp', exact: true })
        ).toHaveCount(role === 'staff' ? 0 : 1);
        await expect(
            page.getByRole('button', { name: `Sửa ${supplier.name}` })
        ).toHaveCount(role === 'staff' ? 0 : 1);
        await page.goto('/admin/store');
        await expect(
            page.getByRole('heading', { name: 'Thông tin quầy' })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Sửa thông tin' })
        ).toHaveCount(0);
        await page.goto('/admin/imports');
        if (role === 'staff')
            await expect(
                page.getByRole('heading', {
                    name: 'Bạn không có quyền truy cập',
                })
            ).toBeVisible();
        else
            await expect(
                page.getByRole('button', {
                    name: 'Lập phiếu nhập',
                    exact: true,
                })
            ).toBeVisible();
    });
}

test('system admin manages an unassigned account even with no stores', async ({
    page,
}) => {
    const state = await mockWorkspace(page, 'system', true);
    await page.goto('/admin/users');
    await expect(
        page.getByRole('heading', { name: 'Tài khoản toàn hệ thống' })
    ).toBeVisible();
    expect(state.userSearch).not.toContain('storeId');
    await page.getByRole('button', { name: 'Sửa Chưa gán quầy' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Vai trò tại quầy')).toHaveCount(0);
    await dialog.getByLabel('Họ và tên').fill('Tên đã cập nhật');
    await dialog.getByLabel('Tài khoản đang hoạt động toàn hệ thống').uncheck();
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog).toHaveCount(0);
    expect(state.userPayload).toMatchObject({
        name: 'Tên đã cập nhật',
        isActive: false,
    });
    expect(state.userPayload).not.toHaveProperty('storeId');
    expect(state.userPayload).not.toHaveProperty('storeRole');
});

for (const width of [360, 768, 1440]) {
    test(`management screens fit ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 1000 });
        const state = await mockWorkspace(page, 'system');
        for (const route of [
            '/admin',
            '/admin/users',
            `/admin/users?storeId=${storeId}`,
            '/admin/stores',
        ]) {
            await page.goto(route);
            await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
            await expect
                .poll(() =>
                    page.evaluate(
                        () => document.documentElement.scrollWidth <= innerWidth
                    )
                )
                .toBe(true);
            await page.screenshot({
                path: `/tmp/pharm-rbac-${route.replaceAll('/', '-')}-${width}.png`,
                fullPage: true,
                animations: 'disabled',
            });
        }
        await page.goto('/admin/users');
        await page.getByRole('button', { name: 'Sửa Chưa gán quầy' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.screenshot({
            path: `/tmp/pharm-rbac-users-${width}.png`,
            fullPage: true,
            animations: 'disabled',
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            )
            .toBe(true);
        state.role = 'owner';
        await page.goto('/admin/store');
        await page.getByRole('button', { name: 'Sửa thông tin' }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
        await page.screenshot({
            path: `/tmp/pharm-rbac-owner-${width}.png`,
            fullPage: true,
            animations: 'disabled',
        });
        await expect
            .poll(() =>
                page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth
                )
            )
            .toBe(true);
    });
}

test('changing from an owned store to a staff store immediately blocks the current management route', async ({
    page,
}) => {
    await mockWorkspace(page, 'owner');
    await page.route('**/stores/context', (route) =>
        route.fulfill({
            json: {
                user: {
                    id: 'owner',
                    name: 'Owner',
                    email: 'owner@example.com',
                    isSystemAdmin: false,
                },
                stores: [
                    { ...store, role: 'owner' },
                    {
                        ...store,
                        id: 'second-store',
                        name: 'Quầy nhân viên',
                        role: 'staff',
                    },
                ],
            },
        })
    );
    await page.goto('/admin/users');
    await expect(
        page.getByRole('heading', { name: `Nhân sự — ${store.name}` })
    ).toBeVisible();
    await page.getByLabel('Quầy đang làm việc').selectOption('second-store');
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Tài khoản', exact: true })
    ).toHaveCount(0);
    await page.reload();
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();
    await page.getByLabel('Quầy đang làm việc').selectOption(storeId);
    await expect(
        page.getByRole('heading', { name: `Nhân sự — ${store.name}` })
    ).toBeVisible();
});
