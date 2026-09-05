import { useEffect } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
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
import type { Store } from '@/features/admin/types';
import { useWorkspace } from '../hooks/useWorkspace';
import { getApiErrorMessage } from '../utils/api-error';
import { Field } from './shared';
const storeSchema = z.object({
    name: z.string().trim().min(1, 'Nhập tên quầy thuốc').max(255),
    phone: z.string().trim().max(20),
    address: z.string().trim().max(1000),
    isActive: z.boolean(),
});

type StoreFormValues = z.infer<typeof storeSchema>;

const emptyValues: StoreFormValues = {
    name: '',
    phone: '',
    address: '',
    isActive: true,
};

export function StoreDialog({
    open,
    onOpenChange,
    store,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    store: Store | null;
}) {
    const { isSystemAdmin } = useWorkspace();
    const queryClient = useQueryClient();
    const form = useForm<StoreFormValues>({
        resolver: zodResolver(storeSchema),
        defaultValues: emptyValues,
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });

    useEffect(() => {
        if (!open) return;
        form.reset(
            store
                ? {
                      name: store.name,
                      phone: store.phone ?? '',
                      address: store.address ?? '',
                      isActive: store.isActive,
                  }
                : emptyValues
        );
    }, [form, open, store]);

    const mutation = useMutation({
        mutationFn: async (values: StoreFormValues) => {
            if (store) {
                await adminService.updateStore(store.id, {
                    name: values.name,
                    ...(isSystemAdmin ? { isActive: values.isActive } : {}),
                    phone: values.phone || null,
                    address: values.address || null,
                });
                return;
            }
            await adminService.createStore({
                name: values.name,
                phone: values.phone || null,
                address: values.address || null,
            });
        },
        onSuccess: () => {
            toast.success(
                store ? 'Đã cập nhật quầy thuốc' : 'Đã tạo quầy thuốc'
            );
            void queryClient.invalidateQueries({
                queryKey: ['admin', 'stores'],
            });
            void queryClient.invalidateQueries({
                queryKey: ['workspace', 'context'],
            });
            form.reset(emptyValues);
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(getApiErrorMessage(error, 'Không thể lưu quầy thuốc.')),
    });

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>
                        {store ? 'Cập nhật quầy thuốc' : 'Tạo quầy thuốc'}
                    </DialogTitle>
                    <DialogDescription>
                        {store ? 'Cập nhật thông tin liên hệ của quầy thuốc.' : 'Sau khi tạo quầy, thêm Owner tại màn Tài khoản.'}
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="store-form"
                    className="space-y-4"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Tên quầy thuốc"
                        required
                        error={form.formState.errors.name?.message}
                    >
                        <Input
                            autoFocus
                            placeholder="Nhà thuốc Trung Tâm"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field
                        label="Số điện thoại"
                        error={form.formState.errors.phone?.message}
                    >
                        <Input
                            inputMode="tel"
                            placeholder="024 1234 5678"
                            {...form.register('phone')}
                        />
                    </Field>
                    <Field
                        label="Địa chỉ"
                        error={form.formState.errors.address?.message}
                    >
                        <textarea
                            rows={3}
                            className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                            placeholder="Địa chỉ kinh doanh"
                            {...form.register('address')}
                        />
                    </Field>
                    {store && isSystemAdmin ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
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
                            Quầy đang hoạt động
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
                        form="store-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        {store ? 'Lưu thay đổi' : 'Tạo quầy'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
