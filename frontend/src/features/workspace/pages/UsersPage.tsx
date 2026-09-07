import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit3, Eye, EyeOff, LoaderCircle, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { adminService } from '@/features/admin/services/admin.service';
import type { AdminUser, StoreRole } from '@/features/admin/types';
import { STORE_ROLE_LABELS } from '../constants/workspace.constants';
import { usePaginatedSearch } from '../hooks/usePaginatedSearch';
import { useWorkspace } from '../hooks/useWorkspace';
import { getApiErrorMessage } from '../utils/api-error';
import {
    EmptyState,
    ErrorState,
    Field,
    LoadingState,
    PageHeader,
    Pager,
    Panel,
    PermissionDenied,
    SearchInput,
    StatusBadge,
} from '../components/shared';

const userSchema = z.object({
    name: z.string().trim().min(1, 'Nhập họ và tên').max(255),
    email: z.email('Email không hợp lệ').max(255),
    phone: z.string().trim().max(20),
    storeRole: z.enum(['owner', 'manager', 'staff']),
    isActive: z.boolean(),
    password: z.union([
        z.literal(''),
        z
            .string()
            .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
            .regex(/[a-zA-Z]/, 'Mật khẩu phải có ít nhất 1 chữ cái')
            .regex(/\d/, 'Mật khẩu phải có ít nhất 1 chữ số'),
    ]),
});

type UserFormValues = z.infer<typeof userSchema>;

function UserDialog({
    open,
    onOpenChange,
    user,
    roleOptions,
    globalScope,
    storeId,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    user: AdminUser | null;
    roleOptions: StoreRole[];
    globalScope: boolean;
    storeId: string;
}) {
    const queryClient = useQueryClient();
    const [showPassword, setShowPassword] = useState(false);
    const currentMembership = user?.storeRoles.find(
        (item) => item.store.id === storeId
    );
    const currentRole = currentMembership?.role ?? roleOptions[0] ?? 'staff';
    const form = useForm<UserFormValues>({
        resolver: zodResolver(userSchema),
        defaultValues: {
            name: '',
            email: '',
            phone: '',
            storeRole: roleOptions[0] ?? 'staff',
            isActive: true,
            password: '',
        },
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (!open) return;
        form.reset(
            user
                ? {
                      name: user.name,
                      email: user.email,
                      phone: user.phone ?? '',
                      storeRole: currentRole,
                      isActive: globalScope
                          ? user.isActive
                          : (currentMembership?.isActive ?? true),
                      password: '',
                  }
                : {
                      name: '',
                      email: '',
                      phone: '',
                      storeRole: roleOptions[0] ?? 'staff',
                      isActive: true,
                      password: '',
                  }
        );
    }, [
        globalScope,
        currentMembership?.isActive,
        currentRole,
        form,
        open,
        roleOptions,
        user,
    ]);

    const mutation = useMutation({
        mutationFn: async (values: UserFormValues) => {
            if (user) {
                await adminService.updateUser(user.id, {
                    ...(globalScope
                        ? {}
                        : {
                              storeId,
                              storeRole: values.storeRole,
                          }),
                    name: values.name,
                    email: values.email,
                    phone: values.phone || null,
                    isActive: values.isActive,
                });
                return;
            }
            return adminService.createUser({
                storeId,
                name: values.name,
                email: values.email,
                phone: values.phone || null,
                storeRole: values.storeRole,
                password: values.password || undefined,
            });
        },
        onSuccess: (result) => {
            toast.success(
                user
                    ? 'Đã cập nhật tài khoản'
                    : result?.existingAccount
                      ? 'Đã thêm tài khoản hiện có vào quầy'
                      : 'Đã tạo tài khoản'
            );
            void queryClient.invalidateQueries({
                queryKey: ['workspace', 'users'],
            });
            form.reset();
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(
                    error,
                    user
                        ? 'Không thể cập nhật tài khoản.'
                        : 'Không thể tạo tài khoản.'
                )
            ),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {user
                            ? 'Cập nhật tài khoản'
                            : 'Thêm tài khoản vào quầy'}
                    </DialogTitle>
                    <DialogDescription>
                        {user
                            ? globalScope
                                ? 'Thông tin và trạng thái tài khoản được áp dụng toàn hệ thống.'
                                : 'Quyền được áp dụng riêng trong quầy đang chọn.'
                            : 'Nhập mật khẩu ban đầu cho tài khoản mới. Tài khoản đã tồn tại sẽ giữ mật khẩu hiện tại.'}
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="user-form"
                    className="grid gap-4 sm:grid-cols-2"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Họ và tên"
                        required
                        error={form.formState.errors.name?.message}
                        className="sm:col-span-2"
                    >
                        <Input
                            autoFocus
                            placeholder="Nguyễn Văn A"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field
                        label="Email"
                        required
                        error={form.formState.errors.email?.message}
                    >
                        <Input
                            type="email"
                            placeholder="nhanvien@nhathuoc.vn"
                            {...form.register('email')}
                        />
                    </Field>
                    <Field
                        label="Số điện thoại"
                        error={form.formState.errors.phone?.message}
                    >
                        <Input
                            inputMode="tel"
                            placeholder="0901 234 567"
                            {...form.register('phone')}
                        />
                    </Field>
                    {!globalScope && (
                        <Field
                            label="Vai trò tại quầy"
                            required
                            error={form.formState.errors.storeRole?.message}
                            className="sm:col-span-2"
                        >
                            <select
                                className="border-input bg-input-background focus:border-ring focus:ring-ring/20 h-9 rounded-md border px-3 text-sm outline-none focus:ring-3"
                                {...form.register('storeRole')}
                            >
                                {roleOptions.map((role) => (
                                    <option key={role} value={role}>
                                        {STORE_ROLE_LABELS[role]}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    {!user ? (
                        <Field
                            label="Mật khẩu ban đầu"
                            error={form.formState.errors.password?.message}
                            className="sm:col-span-2"
                        >
                            <div className="relative">
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    placeholder="Bắt buộc với tài khoản mới"
                                    className="pr-11"
                                    {...form.register('password')}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowPassword((show) => !show)
                                    }
                                    aria-label={
                                        showPassword
                                            ? 'Ẩn mật khẩu'
                                            : 'Hiện mật khẩu'
                                    }
                                    className="text-muted-foreground hover:bg-secondary hover:text-foreground absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-md transition-colors"
                                >
                                    {showPassword ? (
                                        <EyeOff className="size-4" />
                                    ) : (
                                        <Eye className="size-4" />
                                    )}
                                </button>
                            </div>
                        </Field>
                    ) : null}
                    {user ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm sm:col-span-2">
                            <Checkbox
                                checked={isActive}
                                onCheckedChange={(checked) =>
                                    form.setValue(
                                        'isActive',
                                        checked === true,
                                        {
                                            shouldDirty: true,
                                        }
                                    )
                                }
                            />
                            {globalScope
                                ? 'Tài khoản đang hoạt động toàn hệ thống'
                                : 'Quyền truy cập quầy đang hoạt động'}
                        </label>
                    ) : null}
                </form>
                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={mutation.isPending}
                        onClick={() => onOpenChange(false)}
                    >
                        Hủy
                    </Button>
                    <Button
                        form="user-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        {user ? 'Lưu thay đổi' : 'Thêm tài khoản'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function UsersPage({
    storeId,
    onStoreChange,
}: {
    storeId?: string;
    onStoreChange?: (storeId?: string) => void;
}) {
    const { search, setSearch, debouncedSearch, page, setPage } =
        usePaginatedSearch();
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const {
        selectedStoreId,
        selectedStore,
        hasRole,
        isSystemAdmin,
        contextQuery,
    } = useWorkspace();

    const requestedStore = isSystemAdmin
        ? contextQuery.data?.stores.find((store) => store.id === storeId)
        : undefined;
    const invalidStore = isSystemAdmin && Boolean(storeId) && !requestedStore;
    const globalScope = isSystemAdmin && !storeId;
    const scopeStore = isSystemAdmin ? requestedStore : selectedStore;
    const scopeStoreId = scopeStore?.id ?? selectedStoreId;

    const roleOptions = useMemo<StoreRole[]>(() => {
        if (isSystemAdmin) return ['owner', 'manager', 'staff'];
        if (selectedStore?.role === 'owner') return ['manager', 'staff'];
        return ['staff'];
    }, [isSystemAdmin, selectedStore?.role]);

    const usersQuery = useQuery({
        queryKey: [
            'workspace',
            'users',
            globalScope ? 'all' : scopeStoreId,
            debouncedSearch,
            page,
        ],
        queryFn: () =>
            adminService.getUsers({
                storeId: globalScope ? undefined : scopeStoreId,
                search: debouncedSearch,
                page,
                limit: 20,
            }),
        enabled:
            !invalidStore &&
            (globalScope || (Boolean(scopeStoreId) && hasRole('manager'))),
    });

    if (!hasRole('manager')) return <PermissionDenied />;
    if (invalidStore) {
        return (
            <Panel>
                <ErrorState
                    title="Không tìm thấy quầy thuốc"
                    description="Quầy thuốc trong đường dẫn không tồn tại hoặc đã bị xóa."
                />
            </Panel>
        );
    }

    const canManageUser = (user: AdminUser) => {
        if (user.id === contextQuery.data?.user.id || user.isSystemAdmin)
            return false;
        if (isSystemAdmin) return true;
        const targetRole = user.storeRoles[0]?.role;
        if (selectedStore?.role === 'owner') {
            return targetRole === 'manager' || targetRole === 'staff';
        }
        return targetRole === 'staff';
    };

    const openCreate = () => {
        setEditingUser(null);
        setDialogOpen(true);
    };

    const openEdit = (user: AdminUser) => {
        setEditingUser(user);
        setDialogOpen(true);
    };

    return (
        <div className="space-y-5">
            <PageHeader
                title={
                    globalScope
                        ? 'Tài khoản toàn hệ thống'
                        : `Nhân sự — ${scopeStore?.name ?? 'Chưa chọn quầy'}`
                }
                description={
                    globalScope
                        ? 'Quản lý thông tin và trạng thái tài khoản, kể cả tài khoản chưa được gán quầy.'
                        : `Đang hiển thị các tài khoản thuộc ${scopeStore?.name ?? 'quầy thuốc đang chọn'}.`
                }
                actions={
                    !globalScope ? (
                        <Button onClick={openCreate}>
                            <Plus />
                            Thêm tài khoản
                        </Button>
                    ) : undefined
                }
            />

            <Panel className="overflow-hidden">
                <div className="border-border flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-end">
                    {isSystemAdmin && (
                        <Field label="Phạm vi tài khoản">
                            <select
                                className="border-input bg-background focus-visible:outline-ring h-9 rounded-md border px-3 text-sm focus-visible:outline-2"
                                value={globalScope ? 'all' : scopeStoreId}
                                onChange={(event) => {
                                    onStoreChange?.(
                                        event.target.value === 'all'
                                            ? undefined
                                            : event.target.value
                                    );
                                    setPage(1);
                                    setDialogOpen(false);
                                }}
                            >
                                <option value="all">Toàn hệ thống</option>
                                {contextQuery.data?.stores.map((store) => (
                                    <option key={store.id} value={store.id}>
                                        {store.name}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    <SearchInput
                        value={search}
                        onChange={setSearch}
                        placeholder="Tìm tên, email, số điện thoại"
                    />
                </div>
                {usersQuery.isPending ? (
                    <LoadingState />
                ) : usersQuery.isError ? (
                    <ErrorState onRetry={() => void usersQuery.refetch()} />
                ) : !usersQuery.data?.results.length ? (
                    <EmptyState
                        title="Chưa có tài khoản phù hợp"
                        description="Thêm nhân sự mới hoặc gán tài khoản hiện có vào quầy."
                        action={
                            !globalScope && !search ? (
                                <Button onClick={openCreate}>
                                    <Plus />
                                    Thêm tài khoản
                                </Button>
                            ) : undefined
                        }
                    />
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[900px] text-left text-sm">
                                <thead className="bg-muted/55 text-muted-foreground text-xs uppercase">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">
                                            Nhân sự
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Liên hệ
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Quầy thuốc và vai trò
                                        </th>
                                        <th className="px-4 py-3 font-medium">
                                            Trạng thái
                                        </th>
                                        <th className="w-16 px-4 py-3 text-right font-medium">
                                            Sửa
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-border divide-y">
                                    {usersQuery.data.results.map((user) => {
                                        const memberships = globalScope
                                            ? user.storeRoles
                                            : user.storeRoles.filter(
                                                  (item) =>
                                                      item.store.id ===
                                                      scopeStoreId
                                              );
                                        const membership = memberships[0];
                                        const isActive =
                                            user.isActive &&
                                            (globalScope ||
                                                Boolean(membership?.isActive));
                                        const manageable = canManageUser(user);
                                        return (
                                            <tr
                                                key={user.id}
                                                className="hover:bg-muted/30"
                                            >
                                                <td className="px-4 py-3">
                                                    <p className="font-medium">
                                                        {user.name}
                                                    </p>
                                                    <p className="text-muted-foreground mt-0.5 text-xs">
                                                        {user.email}
                                                    </p>
                                                </td>
                                                <td className="text-muted-foreground px-4 py-3">
                                                    {user.phone || '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {user.isSystemAdmin ? (
                                                        <StatusBadge tone="info">
                                                            System Admin
                                                        </StatusBadge>
                                                    ) : memberships.length ? (
                                                        <div className="space-y-2">
                                                            {memberships.map(
                                                                (item) => (
                                                                    <div
                                                                        key={
                                                                            item
                                                                                .store
                                                                                .id
                                                                        }
                                                                        className="flex flex-wrap items-center gap-2"
                                                                    >
                                                                        <span className="font-medium">
                                                                            {
                                                                                item
                                                                                    .store
                                                                                    .name
                                                                            }
                                                                        </span>
                                                                        <StatusBadge tone="neutral">
                                                                            {
                                                                                STORE_ROLE_LABELS[
                                                                                    item
                                                                                        .role
                                                                                ]
                                                                            }
                                                                        </StatusBadge>
                                                                    </div>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            Chưa gán quầy
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <StatusBadge
                                                        tone={
                                                            isActive
                                                                ? 'success'
                                                                : 'danger'
                                                        }
                                                    >
                                                        {isActive
                                                            ? 'Hoạt động'
                                                            : !user.isActive
                                                              ? 'Khóa toàn hệ thống'
                                                              : 'Tạm khóa tại quầy'}
                                                    </StatusBadge>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {manageable ? (
                                                        <Button
                                                            size="icon-sm"
                                                            variant="ghost"
                                                            onClick={() =>
                                                                openEdit(user)
                                                            }
                                                            aria-label={`Sửa ${user.name}`}
                                                            title="Sửa tài khoản"
                                                        >
                                                            <Edit3 />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pager
                            page={usersQuery.data.page}
                            totalPages={usersQuery.data.totalPages}
                            totalResults={usersQuery.data.totalResults}
                            onPageChange={setPage}
                        />
                    </>
                )}
            </Panel>

            <UserDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                user={editingUser}
                roleOptions={roleOptions}
                globalScope={globalScope}
                storeId={scopeStoreId}
            />
        </div>
    );
}
