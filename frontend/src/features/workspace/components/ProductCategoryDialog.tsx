import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
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
import { useWorkspace } from '../hooks/useWorkspace';
import { workspaceService } from '../services/workspace.service';
import type { ProductCategory } from '../types';
import { getApiErrorMessage } from '../utils/api-error';
import { Field } from './shared';

const productCategorySchema = z.object({
    name: z.string().trim().min(1, 'Nhập tên nhóm sản phẩm').max(100),
    description: z.string().trim().max(1000),
    isActive: z.boolean(),
});

type ProductCategoryFormValues = z.infer<typeof productCategorySchema>;

export function ProductCategoryDialog({
    open,
    onOpenChange,
    category,
    onSaved,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    category?: ProductCategory | null;
    onSaved?: (category: ProductCategory) => void;
}) {
    const { selectedStoreId } = useWorkspace();
    const queryClient = useQueryClient();
    const form = useForm<ProductCategoryFormValues>({
        resolver: zodResolver(productCategorySchema),
        defaultValues: {
            name: category?.name ?? '',
            description: category?.description ?? '',
            isActive: category?.isActive ?? true,
        },
    });
    const isActive = useWatch({ control: form.control, name: 'isActive' });
    const mutation = useMutation({
        mutationFn: (values: ProductCategoryFormValues) => {
            const payload = {
                ...values,
                description: values.description || undefined,
            };
            return category
                ? workspaceService.updateProductCategory(
                      selectedStoreId,
                      category.id,
                      payload
                  )
                : workspaceService.createProductCategory(
                      selectedStoreId,
                      payload
                  );
        },
        onSuccess: (savedCategory) => {
            toast.success(
                category ? 'Đã cập nhật nhóm sản phẩm' : 'Đã thêm nhóm sản phẩm'
            );
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'product-categories'],
            });
            void queryClient.invalidateQueries({
                queryKey: ['workspace', selectedStoreId, 'medicines'],
            });
            onSaved?.(savedCategory);
            onOpenChange(false);
        },
        onError: (error) =>
            toast.error(
                getApiErrorMessage(
                    error,
                    'Không thể lưu nhóm sản phẩm. Vui lòng thử lại.'
                )
            ),
    });
    const errors = form.formState.errors;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>
                        {category
                            ? 'Cập nhật nhóm sản phẩm'
                            : 'Thêm nhóm sản phẩm'}
                    </DialogTitle>
                    <DialogDescription>
                        Nhóm được quản lý riêng cho quầy đang chọn và dùng khi
                        thêm sản phẩm vào quầy.
                    </DialogDescription>
                </DialogHeader>
                <form
                    id="product-category-form"
                    className="grid gap-4"
                    onSubmit={form.handleSubmit((values) =>
                        mutation.mutate(values)
                    )}
                >
                    <Field
                        label="Tên nhóm"
                        required
                        error={errors.name?.message}
                    >
                        <Input
                            autoFocus
                            placeholder="Ví dụ: Dược phẩm"
                            {...form.register('name')}
                        />
                    </Field>
                    <Field label="Mô tả" error={errors.description?.message}>
                        <textarea
                            rows={3}
                            className="border-input focus:border-ring focus:ring-ring/20 w-full resize-y rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-3"
                            placeholder="Mô tả ngắn để nhân viên dễ phân biệt"
                            {...form.register('description')}
                        />
                    </Field>
                    {category ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <Checkbox
                                checked={isActive}
                                onCheckedChange={(checked) =>
                                    form.setValue(
                                        'isActive',
                                        checked === true,
                                        { shouldDirty: true }
                                    )
                                }
                            />
                            Đang hoạt động
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
                        form="product-category-form"
                        type="submit"
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? (
                            <LoaderCircle className="animate-spin" />
                        ) : null}
                        {category ? 'Lưu thay đổi' : 'Thêm nhóm'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
