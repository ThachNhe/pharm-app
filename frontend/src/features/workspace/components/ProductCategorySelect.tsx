import { useMemo, useState } from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProductCategory } from '../types';

export function ProductCategorySelect({
    value,
    categories,
    onChange,
    disabled,
}: {
    value: string;
    categories: ProductCategory[];
    onChange: (categoryId: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const selected = categories.find((category) => category.id === value);
    const filtered = useMemo(() => {
        const normalizedSearch = search.trim().toLocaleLowerCase('vi');
        return normalizedSearch
            ? categories.filter((category) =>
                  category.name
                      .toLocaleLowerCase('vi')
                      .includes(normalizedSearch)
              )
            : categories;
    }, [categories, search]);

    return (
        <Popover.Root
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen);
                if (!nextOpen) setSearch('');
            }}
        >
            <Popover.Trigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    disabled={disabled}
                    className="min-w-0 flex-1 shrink justify-between px-3 font-normal"
                    role="combobox"
                    aria-expanded={open}
                    aria-label="Chọn nhóm hàng hóa"
                >
                    <span
                        className={cn(
                            'truncate',
                            !selected && 'text-muted-foreground'
                        )}
                    >
                        {selected?.name ?? 'Chọn nhóm sản phẩm'}
                        {selected && !selected.isActive
                            ? ' (đã ngừng hoạt động)'
                            : ''}
                    </span>
                    <ChevronsUpDown className="text-muted-foreground" />
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    className="border-border bg-popover text-popover-foreground z-[70] w-[var(--radix-popover-trigger-width)] min-w-72 rounded-md border p-2 shadow-lg outline-none"
                >
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            autoFocus
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Tìm nhóm sản phẩm"
                            className="pl-9"
                        />
                    </div>
                    <p className="text-muted-foreground px-2 pt-3 pb-1 text-xs font-medium uppercase">
                        Nhóm sản phẩm
                    </p>
                    <div
                        className="max-h-60 overflow-y-auto"
                        role="listbox"
                        aria-label="Danh sách nhóm sản phẩm"
                    >
                        {filtered.length ? (
                            filtered.map((category) => (
                                <button
                                    key={category.id}
                                    type="button"
                                    role="option"
                                    aria-selected={category.id === value}
                                    disabled={!category.isActive}
                                    onClick={() => {
                                        onChange(category.id);
                                        setOpen(false);
                                    }}
                                    className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Check
                                        className={cn(
                                            'size-4 shrink-0',
                                            category.id !== value && 'invisible'
                                        )}
                                    />
                                    <span className="truncate">
                                        {category.name}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <p className="text-muted-foreground px-2 py-5 text-center text-sm">
                                Không tìm thấy nhóm phù hợp
                            </p>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
