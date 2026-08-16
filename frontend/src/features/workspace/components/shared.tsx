import type { ReactNode } from 'react';
import {
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    Inbox,
    LoaderCircle,
    Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function PageHeader({
    title,
    description,
    actions,
}: {
    title: string;
    description?: string;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
                <h1 className="text-foreground text-2xl font-semibold">
                    {title}
                </h1>
                {description ? (
                    <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-6">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {actions}
                </div>
            ) : null}
        </div>
    );
}

export function Panel({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    return (
        <section
            className={cn(
                'border-border bg-card rounded-lg border shadow-[0_1px_2px_rgba(10,61,82,0.04)]',
                className
            )}
        >
            {children}
        </section>
    );
}

export function StatusBadge({
    tone = 'neutral',
    children,
}: {
    tone?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
    children: ReactNode;
}) {
    return (
        <span
            className={cn(
                'inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-xs font-medium',
                tone === 'success' && 'bg-emerald-100 text-emerald-800',
                tone === 'warning' && 'bg-amber-100 text-amber-800',
                tone === 'danger' && 'bg-rose-100 text-rose-800',
                tone === 'info' && 'bg-sky-100 text-sky-800',
                tone === 'neutral' && 'bg-muted text-muted-foreground'
            )}
        >
            {children}
        </span>
    );
}

export function SearchInput({
    value,
    onChange,
    placeholder = 'Tìm kiếm',
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <div className={cn('relative w-full sm:w-72', className)}>
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="pl-9"
                aria-label={placeholder}
            />
        </div>
    );
}

export function LoadingState({
    label = 'Đang tải dữ liệu',
}: {
    label?: string;
}) {
    return (
        <div className="grid min-h-52 place-items-center p-8 text-center">
            <div>
                <LoaderCircle className="text-primary mx-auto size-6 animate-spin" />
                <p className="text-muted-foreground mt-3 text-sm">{label}</p>
            </div>
        </div>
    );
}

export function EmptyState({
    title,
    description,
    action,
}: {
    title: string;
    description?: string;
    action?: ReactNode;
}) {
    return (
        <div className="grid min-h-52 place-items-center p-8 text-center">
            <div className="max-w-sm">
                <Inbox className="text-muted-foreground/70 mx-auto size-8" />
                <h2 className="mt-3 font-medium">{title}</h2>
                {description ? (
                    <p className="text-muted-foreground mt-1 text-sm leading-6">
                        {description}
                    </p>
                ) : null}
                {action ? (
                    <div className="mt-4 flex justify-center">{action}</div>
                ) : null}
            </div>
        </div>
    );
}

export function ErrorState({
    title = 'Không tải được dữ liệu',
    description,
    onRetry,
}: {
    title?: string;
    description?: string;
    onRetry?: () => void;
}) {
    return (
        <div className="grid min-h-52 place-items-center p-8 text-center">
            <div className="max-w-sm">
                <AlertCircle className="text-destructive mx-auto size-8" />
                <h2 className="mt-3 font-medium">{title}</h2>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                    {description ?? 'Vui lòng thử lại sau ít phút.'}
                </p>
                {onRetry ? (
                    <Button
                        variant="outline"
                        className="mt-4"
                        onClick={onRetry}
                    >
                        Thử lại
                    </Button>
                ) : null}
            </div>
        </div>
    );
}

export function Field({
    label,
    error,
    required,
    children,
    className,
}: {
    label: string;
    error?: string;
    required?: boolean;
    children: ReactNode;
    className?: string;
}) {
    return (
        <label className={cn('grid gap-1.5 text-sm', className)}>
            <span className="font-medium">
                {label}
                {required ? (
                    <span className="text-destructive ml-1">*</span>
                ) : null}
            </span>
            {children}
            {error ? (
                <span className="text-destructive text-xs">{error}</span>
            ) : null}
        </label>
    );
}

export function Pager({
    page,
    totalPages,
    totalResults,
    onPageChange,
}: {
    page: number;
    totalPages: number;
    totalResults: number;
    onPageChange: (page: number) => void;
}) {
    if (totalResults === 0) return null;
    const pageItems: Array<number | 'ellipsis-start' | 'ellipsis-end'> =
        totalPages <= 7
            ? Array.from({ length: totalPages }, (_, index) => index + 1)
            : page <= 4
              ? [1, 2, 3, 4, 5, 'ellipsis-end', totalPages]
              : page >= totalPages - 3
                ? [
                      1,
                      'ellipsis-start',
                      totalPages - 4,
                      totalPages - 3,
                      totalPages - 2,
                      totalPages - 1,
                      totalPages,
                  ]
                : [
                      1,
                      'ellipsis-start',
                      page - 1,
                      page,
                      page + 1,
                      'ellipsis-end',
                      totalPages,
                  ];

    return (
        <div className="border-border flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span className="text-muted-foreground">
                {totalResults.toLocaleString('vi-VN')} kết quả
            </span>
            <div className="flex items-center gap-2">
                <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Trang trước"
                    title="Trang trước"
                >
                    <ChevronLeft />
                </Button>
                <span className="min-w-20 text-center sm:hidden">
                    {page} / {Math.max(totalPages, 1)}
                </span>
                <div className="hidden items-center gap-1 sm:flex">
                    {pageItems.map((item) =>
                        typeof item === 'number' ? (
                            <Button
                                key={item}
                                size="icon-sm"
                                variant={item === page ? 'default' : 'outline'}
                                onClick={() => onPageChange(item)}
                                aria-label={`Trang ${item}`}
                                aria-current={
                                    item === page ? 'page' : undefined
                                }
                            >
                                {item}
                            </Button>
                        ) : (
                            <span
                                key={item}
                                className="text-muted-foreground grid size-8 place-items-center"
                                aria-hidden="true"
                            >
                                …
                            </span>
                        )
                    )}
                </div>
                <Button
                    size="icon-sm"
                    variant="outline"
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Trang sau"
                    title="Trang sau"
                >
                    <ChevronRight />
                </Button>
            </div>
        </div>
    );
}

export function PermissionDenied() {
    return (
        <Panel>
            <ErrorState
                title="Bạn không có quyền truy cập"
                description="Tính năng này không nằm trong phạm vi quyền của bạn tại quầy đang chọn."
            />
        </Panel>
    );
}
