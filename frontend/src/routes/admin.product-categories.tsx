import { createFileRoute } from '@tanstack/react-router';
import { ProductCategoriesPage } from '@/features/workspace/pages/ProductCategoriesPage';

export const Route = createFileRoute('/admin/product-categories')({
    component: ProductCategoriesPage,
});
