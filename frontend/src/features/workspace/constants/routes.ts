import { BarChart3, Boxes, Building2, LayoutDashboard, Library, PackagePlus, Pill, ShoppingCart, Tags, Truck, UserRoundCog } from 'lucide-react';
import type { StoreRole } from '../types';

type NavItem = {
    label: string;
    to:
        | '/admin'
        | '/admin/stores'
        | '/admin/store'
        | '/admin/users'
        | '/admin/medicines'
        | '/admin/medicine-library'
        | '/admin/product-categories'
        | '/admin/suppliers'
        | '/admin/imports'
        | '/admin/inventory'
        | '/admin/sales'
        | '/admin/reports';
    icon: typeof LayoutDashboard;
    minimumRole?: StoreRole;
    systemOnly?: boolean;
};

export const workspaceRoutes: NavItem[] = [
    {
        label: 'Tổng quan',
        to: '/admin',
        icon: LayoutDashboard,
        minimumRole: 'staff',
    },
    {
        label: 'Bán hàng',
        to: '/admin/sales',
        icon: ShoppingCart,
        minimumRole: 'staff',
    },
    {
        label: 'Tồn kho',
        to: '/admin/inventory',
        icon: Boxes,
        minimumRole: 'staff',
    },
    {
        label: 'Danh mục sản phẩm',
        to: '/admin/medicines',
        icon: Pill,
        minimumRole: 'staff',
    },
    {
        label: 'Thư viện thuốc',
        to: '/admin/medicine-library',
        icon: Library,
        minimumRole: 'staff',
    },
    {
        label: 'Nhóm sản phẩm',
        to: '/admin/product-categories',
        icon: Tags,
        minimumRole: 'manager',
    },
    {
        label: 'Nhập hàng',
        to: '/admin/imports',
        icon: PackagePlus,
        minimumRole: 'manager',
    },
    {
        label: 'Nhà cung cấp',
        to: '/admin/suppliers',
        icon: Truck,
        minimumRole: 'staff',
    },
    {
        label: 'Tài khoản',
        to: '/admin/users',
        icon: UserRoundCog,
        minimumRole: 'manager',
    },
    {
        label: 'Báo cáo',
        to: '/admin/reports',
        icon: BarChart3,
        minimumRole: 'manager',
    },
    {
        label: 'Thông tin quầy',
        to: '/admin/store',
        icon: Building2,
        minimumRole: 'staff',
    },
    {
        label: 'Quầy thuốc',
        to: '/admin/stores',
        icon: Building2,
        systemOnly: true,
    },
];

