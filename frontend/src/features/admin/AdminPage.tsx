import {
  Activity,
  Building2,
  FileText,
  LineChart,
  Lock,
  LogOut,
  PackageOpen,
  Pill,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { APP_NAME, ROUTES } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/useAuthStore'
import { authService } from '@/features/auths/services/auth.service'
import { adminService } from './services/admin.service'
import type { MedicineUnit, StoreRole } from './types'

type TabKey = 'overview' | 'stores' | 'users' | 'medicines' | 'receipts' | 'sales' | 'reports'

const tabs: Array<{ key: TabKey; label: string; icon: typeof Activity }> = [
  { key: 'overview', label: 'Tổng quan', icon: Activity },
  { key: 'stores', label: 'Quầy thuốc', icon: Building2 },
  { key: 'users', label: 'Tài khoản', icon: Users },
  { key: 'medicines', label: 'Danh mục thuốc', icon: Pill },
  { key: 'receipts', label: 'Phiếu nhập', icon: PackageOpen },
  { key: 'sales', label: 'Đơn bán', icon: FileText },
  { key: 'reports', label: 'Báo cáo lãi', icon: LineChart },
]

const money = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const asString = (formData: FormData, key: string) => {
  const value = String(formData.get(key) ?? '').trim()
  return value || undefined
}

const baseQuery = { page: 1, limit: 10 }

function SectionTitle({
  title,
  description,
}: {
  title: string
  description?: string
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-normal text-foreground">
        {title}
      </h2>
      {description ? (
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  )
}

function Panel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        className,
      )}
    >
      {children}
    </section>
  )
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
        active
          ? 'bg-secondary text-secondary-foreground'
          : 'bg-destructive/10 text-destructive',
      )}
    >
      {active ? 'Hoạt động' : 'Đã khoá'}
    </span>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid min-h-32 place-items-center rounded-lg border border-dashed border-border bg-muted/40 text-sm text-muted-foreground">
      {label}
    </div>
  )
}

function useRoleOptions(context?: Awaited<ReturnType<typeof adminService.getContext>>) {
  return useMemo<StoreRole[]>(() => {
    if (!context) return ['staff']
    if (context.user.isSystemAdmin) return ['owner', 'manager', 'staff']
    if (context.user.roles.some((role) => role.role === 'owner')) {
      return ['manager', 'staff']
    }
    return ['staff']
  }, [context])
}

function UnitEditor({
  baseUnitName,
  units,
  setUnits,
}: {
  baseUnitName: string
  units: MedicineUnit[]
  setUnits: (units: MedicineUnit[]) => void
}) {
  const addUnit = () =>
    setUnits([
      ...units,
      { name: '', conversionRate: 1, isBaseUnit: false },
    ])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Đơn vị quy đổi</label>
        <Button type="button" size="sm" variant="outline" onClick={addUnit}>
          <Plus className="size-4" />
          Thêm
        </Button>
      </div>
      {units.map((unit, index) => (
        <div
          key={`${unit.name}-${index}`}
          className="grid grid-cols-[1fr_120px_88px_40px] gap-2"
        >
          <Input
            value={unit.isBaseUnit ? baseUnitName : unit.name}
            disabled={unit.isBaseUnit}
            placeholder="Hộp, vỉ, viên"
            onChange={(event) => {
              const next = [...units]
              next[index] = { ...unit, name: event.target.value }
              setUnits(next)
            }}
          />
          <Input
            type="number"
            min="0.0001"
            step="0.0001"
            value={unit.conversionRate}
            disabled={unit.isBaseUnit}
            onChange={(event) => {
              const next = [...units]
              next[index] = {
                ...unit,
                conversionRate: Number(event.target.value),
              }
              setUnits(next)
            }}
          />
          <span className="grid place-items-center rounded-md bg-muted text-xs text-muted-foreground">
            {unit.isBaseUnit ? 'Cơ sở' : 'Quy đổi'}
          </span>
          <Button
            type="button"
            size="icon"
            variant="outline"
            disabled={unit.isBaseUnit}
            onClick={() => setUnits(units.filter((_, itemIndex) => itemIndex !== index))}
            aria-label="Xoá đơn vị"
          >
            <Lock className="size-4" />
          </Button>
        </div>
      ))}
    </div>
  )
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview')
  const [storeSearch, setStoreSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [medicineSearch, setMedicineSearch] = useState('')
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  })
  const [baseUnitName, setBaseUnitName] = useState('viên')
  const [medicineUnits, setMedicineUnits] = useState<MedicineUnit[]>([
    { name: 'viên', conversionRate: 1, isBaseUnit: true },
  ])
  const [message, setMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const router = useRouter()
  const { user, isAuthenticated, isHydrating, logout } = useAuthStore()

  const contextQuery = useQuery({
    queryKey: ['admin', 'context'],
    queryFn: adminService.getContext,
    enabled: isAuthenticated,
  })

  const roleOptions = useRoleOptions(contextQuery.data)
  const storesForSelect = contextQuery.data?.stores ?? []

  const dashboardQuery = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: adminService.getDashboard,
    enabled: isAuthenticated,
  })

  const storesQuery = useQuery({
    queryKey: ['admin', 'stores', storeSearch],
    queryFn: () => adminService.getStores({ ...baseQuery, search: storeSearch }),
    enabled: isAuthenticated,
  })

  const usersQuery = useQuery({
    queryKey: ['admin', 'users', selectedStoreId, userSearch],
    queryFn: () =>
      adminService.getUsers({
        ...baseQuery,
        storeId: selectedStoreId,
        search: userSearch,
      }),
    enabled: isAuthenticated,
  })

  const medicinesQuery = useQuery({
    queryKey: ['admin', 'medicines', medicineSearch],
    queryFn: () =>
      adminService.getMedicines({ ...baseQuery, search: medicineSearch }),
    enabled: isAuthenticated,
  })

  const receiptsQuery = useQuery({
    queryKey: ['admin', 'receipts', selectedStoreId, dateRange],
    queryFn: () =>
      adminService.getImportReceipts({
        ...baseQuery,
        storeId: selectedStoreId,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: isAuthenticated,
  })

  const salesQuery = useQuery({
    queryKey: ['admin', 'sales', selectedStoreId, dateRange],
    queryFn: () =>
      adminService.getSales({
        ...baseQuery,
        storeId: selectedStoreId,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: isAuthenticated,
  })

  const profitQuery = useQuery({
    queryKey: ['admin', 'profit', selectedStoreId, dateRange],
    queryFn: () =>
      adminService.getProfitReport({
        storeId: selectedStoreId,
        from: dateRange.from,
        to: dateRange.to,
      }),
    enabled: isAuthenticated,
  })

  const invalidateAdmin = async () => {
    await queryClient.invalidateQueries({ queryKey: ['admin'] })
  }

  const createStoreMutation = useMutation({
    mutationFn: adminService.createStore,
    onSuccess: async () => {
      setMessage('Đã tạo quầy thuốc và owner.')
      await invalidateAdmin()
    },
  })

  const createUserMutation = useMutation({
    mutationFn: adminService.createUser,
    onSuccess: async () => {
      setMessage('Đã tạo tài khoản.')
      await invalidateAdmin()
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      adminService.updateUser(id, payload),
    onSuccess: async () => {
      setMessage('Đã cập nhật tài khoản.')
      await invalidateAdmin()
    },
  })

  const createMedicineMutation = useMutation({
    mutationFn: adminService.createMedicine,
    onSuccess: async () => {
      setMessage('Đã tạo thuốc.')
      await invalidateAdmin()
    },
  })

  const updateStoreMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      adminService.updateStore(id, payload),
    onSuccess: invalidateAdmin,
  })

  const handleLogout = async () => {
    try {
      await authService.logout()
    } finally {
      logout()
      queryClient.clear()
      router.navigate({ to: ROUTES.HOME })
    }
  }

  const handleCreateStore = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createStoreMutation.mutate({
      name: asString(form, 'name'),
      address: asString(form, 'address'),
      phone: asString(form, 'phone'),
      owner: asString(form, 'ownerEmail')
        ? {
            name: asString(form, 'ownerName'),
            email: asString(form, 'ownerEmail'),
            phone: asString(form, 'ownerPhone'),
            password: asString(form, 'ownerPassword'),
          }
        : undefined,
    })
    event.currentTarget.reset()
  }

  const handleCreateUser = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createUserMutation.mutate({
      storeId: asString(form, 'storeId'),
      storeRole: asString(form, 'storeRole'),
      name: asString(form, 'name'),
      email: asString(form, 'email'),
      phone: asString(form, 'phone'),
      password: asString(form, 'password'),
    })
    event.currentTarget.reset()
  }

  const handleCreateMedicine = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    createMedicineMutation.mutate({
      name: asString(form, 'name'),
      baseUnitName,
      barcode: asString(form, 'barcode'),
      category: asString(form, 'category'),
      manufacturer: asString(form, 'manufacturer'),
      requiresPrescription: form.get('requiresPrescription') === 'on',
      units: medicineUnits.map((unit) => ({
        ...unit,
        name: unit.isBaseUnit ? baseUnitName : unit.name,
      })),
    })
    event.currentTarget.reset()
    setBaseUnitName('viên')
    setMedicineUnits([{ name: 'viên', conversionRate: 1, isBaseUnit: true }])
  }

  const maxSeriesValue = Math.max(
    1,
    ...(profitQuery.data?.series ?? []).map((item) =>
      Math.max(item.revenue, item.profit),
    ),
  )

  if (isHydrating) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4">
        <Panel className="max-w-md text-center">
          <RefreshCw className="mx-auto mb-4 size-10 animate-spin text-primary" />
          <h1 className="text-xl font-semibold">Đang kiểm tra phiên</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hệ thống đang xác thực lại phiên làm việc.
          </p>
        </Panel>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-background p-4">
        <Panel className="max-w-md text-center">
          <ShieldCheck className="mx-auto mb-4 size-10 text-primary" />
          <h1 className="text-xl font-semibold">Cần đăng nhập</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Admin Panel chỉ dành cho System Admin, Owner và Manager.
          </p>
          <Button className="mt-5" onClick={() => router.navigate({ to: ROUTES.HOME })}>
            Về màn đăng nhập
          </Button>
        </Panel>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-sidebar px-4 py-5">
          <div className="mb-6 flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Pill className="size-5" />
            </div>
            <div>
              <p className="font-semibold tracking-normal">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>

          <nav className="space-y-1">
            {tabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key)}
                className={cn(
                  'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm transition-colors',
                  activeTab === key
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground',
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <header className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-6">
            <div>
              <p className="text-sm text-muted-foreground">Xin chào</p>
              <h1 className="text-2xl font-semibold tracking-normal">
                {contextQuery.data?.user.name ?? user?.name ?? 'Admin'}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedStoreId}
                onChange={(event) => setSelectedStoreId(event.target.value)}
                className="h-10 rounded-lg border border-input bg-input-background px-3 text-sm"
              >
                <option value="">Tất cả quầy</option>
                {storesForSelect.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
              <Button variant="outline" onClick={() => invalidateAdmin()}>
                <RefreshCw className="size-4" />
                Làm mới
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="size-4" />
                Đăng xuất
              </Button>
            </div>
          </header>

          <div className="space-y-5 p-4 lg:p-6">
            {message ? (
              <div className="rounded-lg border border-primary/25 bg-secondary px-4 py-3 text-sm text-secondary-foreground">
                {message}
              </div>
            ) : null}

            {activeTab === 'overview' ? (
              <div className="space-y-5">
                <SectionTitle
                  title="Tổng quan vận hành"
                  description="Các chỉ số nhanh cho phạm vi quầy bạn có quyền quản trị."
                />
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    ['Quầy hoạt động', dashboardQuery.data?.storeCount ?? 0],
                    ['Tài khoản hoạt động', dashboardQuery.data?.activeUserCount ?? 0],
                    ['Thuốc đang bán', dashboardQuery.data?.medicineCount ?? 0],
                    ['Đơn 30 ngày', dashboardQuery.data?.orders30Days ?? 0],
                  ].map(([label, value]) => (
                    <Panel key={label}>
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p className="mt-2 text-3xl font-semibold">{value}</p>
                    </Panel>
                  ))}
                </div>
                <Panel>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Doanh thu 30 ngày
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {money.format(dashboardQuery.data?.revenue30Days ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Giá vốn 30 ngày
                      </p>
                      <p className="mt-1 text-xl font-semibold">
                        {money.format(dashboardQuery.data?.cost30Days ?? 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Lãi 30 ngày
                      </p>
                      <p className="mt-1 text-xl font-semibold text-primary">
                        {money.format(dashboardQuery.data?.profit30Days ?? 0)}
                      </p>
                    </div>
                  </div>
                </Panel>
              </div>
            ) : null}

            {activeTab === 'stores' ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle title="Quầy thuốc" />
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        placeholder="Tìm quầy"
                        value={storeSearch}
                        onChange={(event) => setStoreSearch(event.target.value)}
                      />
                    </div>
                  </div>
                  <Panel>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Tên</th>
                            <th className="px-3 py-2">Điện thoại</th>
                            <th className="px-3 py-2">Nhân sự</th>
                            <th className="px-3 py-2">Trạng thái</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {storesQuery.data?.results.map((store) => (
                            <tr key={store.id} className="border-t border-border">
                              <td className="px-3 py-3">
                                <p className="font-medium">{store.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {store.address ?? 'Chưa có địa chỉ'}
                                </p>
                              </td>
                              <td className="px-3 py-3">{store.phone ?? '-'}</td>
                              <td className="px-3 py-3">{store._count?.roles ?? 0}</td>
                              <td className="px-3 py-3">
                                <StatusPill active={store.isActive} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                {contextQuery.data?.user.isSystemAdmin ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateStoreMutation.mutate({
                                        id: store.id,
                                        payload: { isActive: !store.isActive },
                                      })
                                    }
                                  >
                                    {store.isActive ? 'Khoá' : 'Mở'}
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!storesQuery.data?.results.length ? (
                      <EmptyState label="Chưa có quầy thuốc" />
                    ) : null}
                  </Panel>
                </div>

                {contextQuery.data?.user.isSystemAdmin ? (
                  <Panel>
                    <SectionTitle
                      title="Tạo quầy mới"
                      description="Có thể tạo owner đầu tiên trong cùng một luồng."
                    />
                    <form onSubmit={handleCreateStore} className="mt-4 space-y-3">
                      <Input name="name" required placeholder="Tên quầy" />
                      <Input name="address" placeholder="Địa chỉ" />
                      <Input name="phone" placeholder="Số điện thoại" />
                      <div className="border-t border-border pt-3">
                        <p className="mb-3 text-sm font-medium">Owner đầu tiên</p>
                        <div className="space-y-3">
                          <Input name="ownerName" placeholder="Tên owner" />
                          <Input name="ownerEmail" type="email" placeholder="Email owner" />
                          <Input name="ownerPhone" placeholder="SĐT owner" />
                          <Input
                            name="ownerPassword"
                            type="password"
                            placeholder="Mật khẩu tạm"
                          />
                        </div>
                      </div>
                      <Button className="w-full" disabled={createStoreMutation.isPending}>
                        <Plus className="size-4" />
                        Tạo quầy
                      </Button>
                    </form>
                  </Panel>
                ) : null}
              </div>
            ) : null}

            {activeTab === 'users' ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle title="Tài khoản" />
                    <Input
                      className="w-64"
                      placeholder="Tìm tên, email, SĐT"
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                    />
                  </div>
                  <Panel>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Nhân sự</th>
                            <th className="px-3 py-2">Quầy/role</th>
                            <th className="px-3 py-2">Trạng thái</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {usersQuery.data?.results.map((adminUser) => (
                            <tr key={adminUser.id} className="border-t border-border">
                              <td className="px-3 py-3">
                                <p className="font-medium">{adminUser.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {adminUser.email}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                {adminUser.isSystemAdmin
                                  ? 'System Admin'
                                  : adminUser.storeRoles
                                      .map((role) => `${role.store.name}: ${role.role}`)
                                      .join(', ')}
                              </td>
                              <td className="px-3 py-3">
                                <StatusPill active={adminUser.isActive} />
                              </td>
                              <td className="px-3 py-3 text-right">
                                {!adminUser.isSystemAdmin ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateUserMutation.mutate({
                                        id: adminUser.id,
                                        payload: {
                                          storeId:
                                            selectedStoreId ||
                                            adminUser.storeRoles[0]?.store.id,
                                          isActive: !adminUser.isActive,
                                        },
                                      })
                                    }
                                  >
                                    {adminUser.isActive ? 'Khoá' : 'Mở'}
                                  </Button>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!usersQuery.data?.results.length ? (
                      <EmptyState label="Chưa có tài khoản trong phạm vi này" />
                    ) : null}
                  </Panel>
                </div>

                <Panel>
                  <SectionTitle title="Tạo tài khoản" />
                  <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
                    <select
                      name="storeId"
                      required
                      className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm"
                    >
                      <option value="">Chọn quầy</option>
                      {storesForSelect.map((store) => (
                        <option key={store.id} value={store.id}>
                          {store.name}
                        </option>
                      ))}
                    </select>
                    <select
                      name="storeRole"
                      required
                      className="h-10 w-full rounded-lg border border-input bg-input-background px-3 text-sm"
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <Input name="name" required placeholder="Họ tên" />
                    <Input name="email" type="email" required placeholder="Email" />
                    <Input name="phone" placeholder="Số điện thoại" />
                    <Input
                      name="password"
                      type="password"
                      required
                      placeholder="Mật khẩu tạm"
                    />
                    <Button className="w-full" disabled={createUserMutation.isPending}>
                      <Plus className="size-4" />
                      Tạo tài khoản
                    </Button>
                  </form>
                </Panel>
              </div>
            ) : null}

            {activeTab === 'medicines' ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_460px]">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <SectionTitle title="Danh mục thuốc" />
                    <Input
                      className="w-64"
                      placeholder="Tìm thuốc, barcode"
                      value={medicineSearch}
                      onChange={(event) => setMedicineSearch(event.target.value)}
                    />
                  </div>
                  <Panel>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Thuốc</th>
                            <th className="px-3 py-2">Đơn vị</th>
                            <th className="px-3 py-2">Barcode</th>
                            <th className="px-3 py-2">Loại</th>
                          </tr>
                        </thead>
                        <tbody>
                          {medicinesQuery.data?.results.map((medicine) => (
                            <tr key={medicine.id} className="border-t border-border">
                              <td className="px-3 py-3">
                                <p className="font-medium">{medicine.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {medicine.manufacturer ?? 'Chưa có NSX'}
                                </p>
                              </td>
                              <td className="px-3 py-3">
                                {medicine.units
                                  .map(
                                    (unit) =>
                                      `${unit.name} = ${unit.conversionRate} ${medicine.baseUnitName}`,
                                  )
                                  .join(', ')}
                              </td>
                              <td className="px-3 py-3">{medicine.barcode ?? '-'}</td>
                              <td className="px-3 py-3">{medicine.category ?? '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {!medicinesQuery.data?.results.length ? (
                      <EmptyState label="Chưa có thuốc" />
                    ) : null}
                  </Panel>
                </div>

                <Panel>
                  <SectionTitle title="Tạo thuốc" />
                  <form onSubmit={handleCreateMedicine} className="mt-4 space-y-3">
                    <Input name="name" required placeholder="Tên thuốc" />
                    <Input
                      value={baseUnitName}
                      onChange={(event) => {
                        setBaseUnitName(event.target.value)
                        setMedicineUnits((units) =>
                          units.map((unit) =>
                            unit.isBaseUnit
                              ? { ...unit, name: event.target.value }
                              : unit,
                          ),
                        )
                      }}
                      placeholder="Đơn vị cơ sở"
                    />
                    <Input name="barcode" placeholder="Mã vạch" />
                    <Input name="category" placeholder="Danh mục" />
                    <Input name="manufacturer" placeholder="Nhà sản xuất" />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input name="requiresPrescription" type="checkbox" />
                      Thuốc kê đơn
                    </label>
                    <UnitEditor
                      baseUnitName={baseUnitName}
                      units={medicineUnits}
                      setUnits={setMedicineUnits}
                    />
                    <Button
                      className="w-full"
                      disabled={createMedicineMutation.isPending}
                    >
                      <Plus className="size-4" />
                      Tạo thuốc
                    </Button>
                  </form>
                </Panel>
              </div>
            ) : null}

            {activeTab === 'receipts' || activeTab === 'sales' || activeTab === 'reports' ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  <SectionTitle
                    title={
                      activeTab === 'receipts'
                        ? 'Phiếu nhập'
                        : activeTab === 'sales'
                          ? 'Đơn bán'
                          : 'Báo cáo lãi'
                    }
                    description="Dữ liệu read-only trong Admin Panel."
                  />
                  <div className="ml-auto flex gap-2">
                    <Input
                      type="date"
                      value={dateRange.from}
                      onChange={(event) =>
                        setDateRange((range) => ({
                          ...range,
                          from: event.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      value={dateRange.to}
                      onChange={(event) =>
                        setDateRange((range) => ({
                          ...range,
                          to: event.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                {activeTab === 'reports' ? (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      {[
                        ['Doanh thu', profitQuery.data?.totals.revenue ?? 0],
                        ['Giá vốn', profitQuery.data?.totals.cost ?? 0],
                        ['Lãi', profitQuery.data?.totals.profit ?? 0],
                        ['Số đơn', profitQuery.data?.totals.orders ?? 0],
                      ].map(([label, value]) => (
                        <Panel key={label}>
                          <p className="text-sm text-muted-foreground">{label}</p>
                          <p className="mt-2 text-xl font-semibold">
                            {typeof value === 'number' && label !== 'Số đơn'
                              ? money.format(value)
                              : value}
                          </p>
                        </Panel>
                      ))}
                    </div>
                    <Panel>
                      <div className="flex h-72 items-end gap-2">
                        {(profitQuery.data?.series ?? []).map((item) => (
                          <div
                            key={`${item.date}-${item.revenue}-${item.profit}`}
                            className="flex min-w-8 flex-1 items-end gap-1"
                            title={`${new Date(item.date).toLocaleDateString('vi-VN')}: ${money.format(item.revenue)}`}
                          >
                            <div
                              className="w-full rounded-t bg-primary"
                              style={{
                                height: `${Math.max(4, (item.revenue / maxSeriesValue) * 100)}%`,
                              }}
                            />
                            <div
                              className="w-full rounded-t bg-accent"
                              style={{
                                height: `${Math.max(4, (item.profit / maxSeriesValue) * 100)}%`,
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </Panel>
                  </div>
                ) : null}

                {activeTab === 'receipts' ? (
                  <Panel>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Ngày nhập</th>
                            <th className="px-3 py-2">Quầy</th>
                            <th className="px-3 py-2">Nhà cung cấp</th>
                            <th className="px-3 py-2">Dòng thuốc</th>
                            <th className="px-3 py-2">Tổng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {receiptsQuery.data?.results.map((receipt) => (
                            <tr key={receipt.id} className="border-t border-border">
                              <td className="px-3 py-3">
                                {new Date(receipt.importedAt).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="px-3 py-3">{receipt.store.name}</td>
                              <td className="px-3 py-3">{receipt.supplier?.name ?? '-'}</td>
                              <td className="px-3 py-3">{receipt.details.length}</td>
                              <td className="px-3 py-3">
                                {money.format(Number(receipt.totalAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                ) : null}

                {activeTab === 'sales' ? (
                  <Panel>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-3 py-2">Ngày bán</th>
                            <th className="px-3 py-2">Quầy</th>
                            <th className="px-3 py-2">Nhân viên</th>
                            <th className="px-3 py-2">Dòng thuốc</th>
                            <th className="px-3 py-2">Tổng</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salesQuery.data?.results.map((sale) => (
                            <tr key={sale.id} className="border-t border-border">
                              <td className="px-3 py-3">
                                {new Date(sale.soldAt).toLocaleDateString('vi-VN')}
                              </td>
                              <td className="px-3 py-3">{sale.store.name}</td>
                              <td className="px-3 py-3">{sale.soldByUser.name}</td>
                              <td className="px-3 py-3">{sale.details.length}</td>
                              <td className="px-3 py-3">
                                {money.format(Number(sale.totalAmount))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Panel>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  )
}
