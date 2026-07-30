import { createFileRoute } from '@tanstack/react-router';
import { MedicinesPage } from '@/features/workspace/pages/MedicinesPage';

export const Route = createFileRoute('/admin/medicines')({
    component: MedicinesPage,
});
