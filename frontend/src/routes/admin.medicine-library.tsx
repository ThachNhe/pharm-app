import { createFileRoute } from '@tanstack/react-router';
import { MedicineLibraryPage } from '@/features/workspace/pages/MedicineLibraryPage';

export const Route = createFileRoute('/admin/medicine-library')({
    component: MedicineLibraryPage,
});
