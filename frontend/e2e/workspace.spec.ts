import {
    expect,
    test,
    type APIRequestContext,
    type Page,
} from '@playwright/test';

const apiUrl = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3000/v1';
const mailhogUrl =
    process.env.PLAYWRIGHT_MAILHOG_URL ?? 'http://localhost:8025';

async function loginWithOtp(
    page: Page,
    request: APIRequestContext,
    email: string
) {
    await request.delete(`${mailhogUrl}/api/v1/messages`);
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Mật khẩu', { exact: true }).fill('12345abcd');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();

    await expect(
        page.getByRole('heading', { name: 'Xác minh đăng nhập' })
    ).toBeVisible();

    let otpCode = '';
    await expect
        .poll(
            async () => {
                const response = await request.get(
                    `${mailhogUrl}/api/v2/messages?limit=10`
                );
                const body = (await response.json()) as {
                    items: Array<{
                        To: Array<{ Mailbox: string; Domain: string }>;
                        Content: { Body: string };
                    }>;
                };
                const message = body.items.find((item) =>
                    item.To.some(
                        (recipient) =>
                            `${recipient.Mailbox}@${recipient.Domain}` === email
                    )
                );
                otpCode = message?.Content.Body.match(/\b\d{6}\b/)?.[0] ?? '';
                return otpCode.length;
            },
            { timeout: 10_000 }
        )
        .toBe(6);

    await page.getByLabel('Mã xác minh').fill(otpCode);
    await page.getByRole('button', { name: 'Xác minh' }).click();
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(
        page.getByRole('heading', { name: /Tổng quan/ })
    ).toBeVisible();
}

test('owner can use the operational workspace across desktop and mobile', async ({
    page,
    request,
}) => {
    const browserErrors: string[] = [];
    const serverErrors: string[] = [];
    page.on('console', (message) => {
        if (
            message.type() === 'error' &&
            !message.text().includes('401 (Unauthorized)')
        ) {
            browserErrors.push(message.text());
        }
    });
    page.on('pageerror', (error) => browserErrors.push(error.message));
    page.on('response', (response) => {
        if (response.status() >= 500) {
            serverErrors.push(`${response.status()} ${response.url()}`);
        }
    });

    await page.setViewportSize({ width: 1440, height: 1000 });
    await loginWithOtp(page, request, 'owner@gmail.com');

    const routes = [
        ['Bán hàng', 'Bán hàng'],
        ['Tồn kho', 'Tồn kho'],
        ['Danh mục sản phẩm', 'Danh mục sản phẩm'],
        ['Thư viện thuốc', 'Thư viện thuốc'],
        ['Nhóm sản phẩm', 'Nhóm sản phẩm'],
        ['Nhập hàng', 'Nhập hàng'],
        ['Nhà cung cấp', 'Nhà cung cấp'],
        ['Tài khoản', /^Nhân sự — /],
        ['Báo cáo', 'Báo cáo kinh doanh'],
        ['Thông tin quầy', 'Thông tin quầy'],
    ] as const;

    for (const [linkName, heading] of routes) {
        await page.getByRole('link', { name: linkName, exact: true }).click();
        await expect(
            page.getByRole('heading', { name: heading, exact: true })
        ).toBeVisible();
    }

    await page.goto('/admin/medicine-library');
    await expect(page.getByText(/\d[\d.]* sản phẩm/)).toBeVisible();
    await expect(page.getByRole('columnheader')).toHaveCount(22);
    await expect(
        page.getByText(/Số lô, hạn dùng và số lượng thực tế/)
    ).toBeVisible();
    await page.getByRole('button', { name: 'Trang 2', exact: true }).click();
    await expect(
        page.getByRole('button', { name: 'Trang 2', exact: true })
    ).toHaveAttribute('aria-current', 'page');
    await page
        .getByPlaceholder('Tìm tên, mã, barcode, SĐK, hoạt chất...')
        .fill('HH02726');
    const libraryRow = page.getByRole('row', {
        name: /HH02726 Acyclovir 800Mg\/ Stada/,
    });
    await expect(libraryRow).toContainText('20.400');
    await expect(libraryRow).toContainText('22.000');
    await expect(libraryRow).toContainText('Dược phẩm');

    await page.goto('/admin/medicines');
    const storeProductsTable = page.getByLabel(
        'Bảng sản phẩm đang bán tại quầy'
    );
    await expect(storeProductsTable).toBeVisible();
    await expect(
        storeProductsTable.getByRole('columnheader', { name: 'Lô bán trước' })
    ).toBeVisible();
    await expect(
        storeProductsTable.getByRole('columnheader', { name: 'Hạn dùng' })
    ).toBeVisible();
    await expect(
        storeProductsTable.getByRole('columnheader', { name: 'Giá nhập' })
    ).toBeVisible();
    await expect(
        storeProductsTable.getByRole('columnheader', { name: 'Giá bán lẻ' })
    ).toBeVisible();
    await page.screenshot({
        path: '/tmp/pharm-medicines-desktop.png',
        fullPage: true,
    });
    await page.route(/\/v1\/stores\/[^/]+\/medicines\/next-code$/, (route) =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'SP000338' }),
        })
    );
    await page
        .getByRole('button', { name: 'Thêm sản phẩm', exact: true })
        .click();
    const medicineDialog = page.getByRole('dialog');
    await expect(
        medicineDialog.getByRole('button', {
            name: 'Từ thư viện',
            exact: true,
        })
    ).toBeVisible();
    await medicineDialog
        .getByRole('button', { name: 'Từ thư viện', exact: true })
        .click();
    await medicineDialog
        .getByPlaceholder('Tìm tên thuốc hoặc quét barcode')
        .fill('HH02726');
    await medicineDialog
        .getByRole('button', { name: /Acyclovir 800Mg\/ Stada/ })
        .click();
    await expect(medicineDialog.getByLabel('Tên sản phẩm')).toHaveValue(
        'Acyclovir 800Mg/ Stada'
    );
    await expect(medicineDialog.getByLabel('Mã hàng hóa')).toHaveValue(
        'SP000338'
    );
    await expect(medicineDialog.getByLabel('Mã hàng hóa')).toBeEditable();
    await medicineDialog.getByLabel('Mã hàng hóa').fill('SP000339');
    await expect(
        medicineDialog.getByRole('combobox', {
            name: 'Chọn nhóm hàng hóa',
        })
    ).toContainText('Dược phẩm');

    let createPayload: Record<string, unknown> | null = null;
    await page.route(/\/v1\/stores\/[^/]+\/medicines$/, async (route) => {
        if (route.request().method() !== 'POST') {
            await route.continue();
            return;
        }
        createPayload = route.request().postDataJSON() as Record<
            string,
            unknown
        >;
        await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({ id: 'ui-test-medicine' }),
        });
    });
    await medicineDialog.getByLabel('Giá bán').fill('25000');
    await medicineDialog
        .getByRole('button', { name: 'Thêm sản phẩm', exact: true })
        .click();
    await expect.poll(() => createPayload).not.toBeNull();
    expect(createPayload).toMatchObject({
        referenceProductId: 'fffe7ae2-015e-4861-b4ce-501ef47ad5b7',
        categoryId: expect.any(String),
        code: 'SP000339',
        name: 'Acyclovir 800Mg/ Stada',
        sellingPrice: 25000,
        units: expect.arrayContaining([
            {
                name: expect.any(String),
                conversionRate: 1,
                isBaseUnit: true,
            },
        ]),
    });
    await expect(medicineDialog).toBeHidden();

    await page
        .getByRole('button', { name: 'Thêm sản phẩm', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Nhập thủ công', exact: true })
        .click();
    await expect(page.getByLabel('Tên sản phẩm')).toBeVisible();
    await expect(page.getByLabel('Mã hàng hóa')).toHaveValue('SP000338');
    await expect(page.getByLabel('Mã hàng hóa')).toBeEditable();
    await page.getByRole('button', { name: 'Thêm đơn vị tính' }).click();
    await page.getByLabel('Tên đơn vị').fill('Bình');
    await page
        .getByRole('button', { name: 'Thêm đơn vị', exact: true })
        .click();
    await expect(page.getByLabel('Đơn vị nhỏ nhất')).toHaveValue('Bình');
    await page.getByLabel('Đơn vị nhỏ nhất').selectOption('Viên');
    await page.getByRole('button', { name: 'Thêm quy đổi' }).click();
    await page
        .getByLabel('Đơn vị quy đổi 1', { exact: true })
        .selectOption('Vỉ');
    await page.getByLabel('Hệ số quy đổi 1').fill('12');
    await expect(page.getByText('Tồn kho luôn lưu theo viên.')).toBeVisible();
    await page.getByRole('button', { name: 'Thêm nhóm sản phẩm' }).click();
    await expect(
        page.getByRole('heading', { name: 'Thêm nhóm sản phẩm' })
    ).toBeVisible();
    await page.getByRole('button', { name: 'Hủy', exact: true }).last().click();
    await page.getByRole('button', { name: 'Hủy', exact: true }).click();

    await page.goto('/admin/imports');
    await page
        .getByRole('button', { name: 'Lập phiếu nhập', exact: true })
        .first()
        .click();
    const importDialog = page.getByRole('dialog');
    await importDialog
        .getByRole('button', { name: 'Lưu phiếu nháp', exact: true })
        .click();
    await importDialog.getByLabel('Sản phẩm').selectOption({ index: 1 });
    const inputTops = await Promise.all(
        [
            'medicineId',
            'unitId',
            'batchNumber',
            'quantity',
            'importPrice',
            'expiryDate',
        ].map((name) =>
            importDialog
                .locator(`[name="items.0.${name}"]`)
                .evaluate((element) => element.getBoundingClientRect().top)
        )
    );
    expect(Math.max(...inputTops) - Math.min(...inputTops)).toBeLessThanOrEqual(
        1
    );
    await page.screenshot({
        path: '/tmp/pharm-import-dialog-desktop.png',
        fullPage: true,
    });
    await importDialog
        .getByRole('button', { name: 'Hủy', exact: true })
        .click();

    await page.goto('/admin/inventory?alert=low');
    await expect(
        page.getByRole('heading', { name: 'Tồn kho', exact: true })
    ).toBeVisible();
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/inventory\?alert=low$/);
    await expect(
        page.getByRole('heading', { name: 'Tồn kho', exact: true })
    ).toBeVisible();

    await page.goto('/admin');
    await expect(
        page.getByRole('heading', { name: /Tổng quan/ })
    ).toBeVisible();
    await page.screenshot({
        path: '/tmp/pharm-dashboard-desktop.png',
        fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Mở menu' }).click();
    await expect(
        page.getByRole('navigation', { name: 'Điều hướng chính' }).last()
    ).toBeVisible();
    await page
        .getByRole('link', { name: 'Thư viện thuốc', exact: true })
        .last()
        .click();
    await expect(
        page.getByRole('heading', { name: 'Thư viện thuốc', exact: true })
    ).toBeVisible();
    await expect
        .poll(() =>
            page
                .getByLabel('Bảng thông tin chi tiết thư viện thuốc')
                .evaluate(
                    (element) => element.scrollWidth > element.clientWidth
                )
        )
        .toBe(true);
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth
            )
        )
        .toBe(true);

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await page
        .getByRole('link', { name: 'Danh mục sản phẩm', exact: true })
        .last()
        .click();
    await expect
        .poll(() =>
            page
                .getByLabel('Bảng sản phẩm đang bán tại quầy')
                .evaluate(
                    (element) => element.scrollWidth > element.clientWidth
                )
        )
        .toBe(true);
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth
            )
        )
        .toBe(true);

    await page.getByRole('button', { name: 'Mở menu' }).click();
    await page
        .getByRole('link', { name: 'Bán hàng', exact: true })
        .last()
        .click();
    await expect(
        page.getByRole('heading', { name: 'Bán hàng', exact: true })
    ).toBeVisible();
    await expect
        .poll(() =>
            page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth
            )
        )
        .toBe(true);
    await page.screenshot({
        path: '/tmp/pharm-sales-mobile.png',
        fullPage: true,
    });

    expect(browserErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
    const unauthenticatedContext = await request.get(
        `${apiUrl}/stores/context`
    );
    expect(unauthenticatedContext.status()).toBe(401);
});

test('owner sees store management features but not system store administration', async ({
    page,
    request,
}) => {
    await loginWithOtp(page, request, 'owner@gmail.com');

    for (const linkName of [
        'Bán hàng',
        'Tồn kho',
        'Danh mục sản phẩm',
        'Thư viện thuốc',
        'Nhóm sản phẩm',
        'Nhập hàng',
        'Nhà cung cấp',
        'Tài khoản',
        'Báo cáo',
    ]) {
        await expect(
            page.getByRole('link', { name: linkName, exact: true })
        ).toBeVisible();
    }
    await expect(
        page.getByRole('link', { name: 'Quầy thuốc', exact: true })
    ).toHaveCount(0);

    await page.goto('/admin/stores');
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();

    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const roleSelect = page.getByLabel('Vai trò tại quầy');
    await expect(roleSelect.locator('option')).toHaveCount(2);
    expect(await roleSelect.locator('option').allTextContents()).toEqual([
        'Quản lý',
        'Nhân viên',
    ]);
});

test('manager can manage staff only', async ({ page, request }) => {
    await loginWithOtp(page, request, 'manager@gmail.com');
    await expect(
        page.getByRole('link', { name: 'Tài khoản', exact: true })
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Nhóm sản phẩm', exact: true })
    ).toBeVisible();
    await expect(
        page.getByRole('link', { name: 'Quầy thuốc', exact: true })
    ).toHaveCount(0);

    await page.goto('/admin/users');
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const roleSelect = page.getByLabel('Vai trò tại quầy');
    await expect(roleSelect.locator('option')).toHaveCount(1);
    await expect(roleSelect).toHaveValue('staff');
});

test('staff navigation and direct routes remain permission scoped', async ({
    page,
    request,
}) => {
    await loginWithOtp(page, request, 'staff@gmail.com');

    for (const linkName of [
        'Tổng quan',
        'Bán hàng',
        'Tồn kho',
        'Danh mục sản phẩm',
        'Thư viện thuốc',
        'Nhà cung cấp',
        'Thông tin quầy',
    ]) {
        await expect(
            page.getByRole('link', { name: linkName, exact: true })
        ).toBeVisible();
    }
    for (const linkName of [
        'Nhập hàng',
        'Tài khoản',
        'Báo cáo',
        'Nhóm sản phẩm',
        'Quầy thuốc',
    ]) {
        await expect(
            page.getByRole('link', { name: linkName, exact: true })
        ).toHaveCount(0);
    }

    await page.goto('/admin/reports');
    await expect(
        page.getByRole('heading', { name: 'Bạn không có quyền truy cập' })
    ).toBeVisible();
});
