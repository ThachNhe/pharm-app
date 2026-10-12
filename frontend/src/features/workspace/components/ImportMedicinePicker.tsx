import { useState, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Check,
    ChevronsUpDown,
    LoaderCircle,
    PackagePlus,
    Search,
} from 'lucide-react';
import { Popover } from 'radix-ui';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';
import { cn, formatNumber } from '@/lib/utils';
import { workspaceService } from '../services/workspace.service';
import type { Medicine } from '../types';
import { useWorkspace } from '../hooks/useWorkspace';

const PICKER_RESULT_LIMIT = 20;

const normalize = (value: string | null | undefined) =>
    (value ?? '').trim().toLocaleLowerCase('vi');

// A scanned barcode or typed code that matches exactly one product is picked on Enter.
const findExactMatch = (medicines: Medicine[], search: string) => {
    const term = normalize(search);
    if (!term) return undefined;
    const matches = medicines.filter(
        (medicine) =>
            medicine.isActive &&
            [
                medicine.code,
                medicine.barcode,
                medicine.secondaryBarcode,
                medicine.registrationNumber,
            ].some((value) => normalize(value) === term)
    );
    return matches.length === 1 ? matches[0] : undefined;
};

export function ImportMedicinePicker({
    value,
    onSelect,
    onCreateNew,
    invalid,
    rowLabel,
}: {
    value: Medicine | undefined;
    onSelect: (medicine: Medicine) => void;
    onCreateNew: (search: string) => void;
    invalid?: boolean;
    rowLabel: string;
}) {
    const { selectedStoreId } = useWorkspace();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const debouncedSearch = useDebounce(search.trim(), 300);
    const listId = `${rowLabel.replace(/\s+/g, '-')}-medicine-options`;

    const medicinesQuery = useQuery({
        queryKey: [
            'workspace',
            selectedStoreId,
            'medicines',
            'import-picker',
            debouncedSearch,
        ],
        queryFn: () =>
            workspaceService.getMedicines(selectedStoreId, {
                search: debouncedSearch || undefined,
                page: 1,
                limit: PICKER_RESULT_LIMIT,
            }),
        enabled: open && Boolean(selectedStoreId),
        placeholderData: (previous) => previous,
    });
    const results = medicinesQuery.data?.results ?? [];
    const isSearching =
        medicinesQuery.isFetching || debouncedSearch !== search.trim();

    const close = () => {
        setOpen(false);
        setSearch('');
        setActiveIndex(0);
    };

    const choose = (medicine: Medicine) => {
        if (!medicine.isActive) return;
        onSelect(medicine);
        close();
    };

    const createNew = () => {
        const name = search.trim();
        close();
        onCreateNew(name);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!results.length) return;
            const step = event.key === 'ArrowDown' ? 1 : -1;
            setActiveIndex(
                (current) => (current + step + results.length) % results.length
            );
            return;
        }
        if (event.key !== 'Enter') return;
        event.preventDefault();
        if (isSearching) return;
        const exact = findExactMatch(results, search);
        const active = results[activeIndex];
        if (exact) choose(exact);
        else if (active) choose(active);
    };

    return (
        <Popover.Root
            open={open}
            onOpenChange={(nextOpen) => (nextOpen ? setOpen(true) : close())}
        >
            <Popover.Trigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="w-full min-w-0 justify-between px-3 font-normal"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-invalid={invalid}
                    aria-label={`Chọn sản phẩm cho ${rowLabel}`}
                >
                    <span
                        className={cn(
                            'truncate',
                            !value && 'text-muted-foreground'
                        )}
                    >
                        {value?.name ?? 'Tìm và chọn sản phẩm'}
                    </span>
                    <ChevronsUpDown className="text-muted-foreground" />
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="start"
                    sideOffset={6}
                    collisionPadding={16}
                    className="border-border bg-popover text-popover-foreground z-[70] w-[min(var(--radix-popover-trigger-width),calc(100vw-2rem))] min-w-[min(22rem,calc(100vw-2rem))] rounded-md border p-2 shadow-lg outline-none"
                >
                    <div className="relative">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            autoFocus
                            value={search}
                            onChange={(event) => {
                                setSearch(event.target.value);
                                setActiveIndex(0);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder="Tên, mã hàng, mã vạch, số đăng ký"
                            aria-label="Tìm sản phẩm trong quầy"
                            aria-controls={listId}
                            aria-activedescendant={
                                results[activeIndex]
                                    ? `${listId}-${results[activeIndex].id}`
                                    : undefined
                            }
                            className="pr-9 pl-9"
                        />
                        {isSearching ? (
                            <LoaderCircle className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
                        ) : null}
                    </div>
                    <p className="text-muted-foreground px-2 pt-3 pb-1 text-xs font-medium uppercase">
                        Sản phẩm trong quầy
                    </p>
                    <div
                        id={listId}
                        className="max-h-64 overflow-y-auto"
                        role="listbox"
                        aria-label="Sản phẩm trong quầy"
                    >
                        {medicinesQuery.isError ? (
                            <div className="px-2 py-5 text-center text-sm">
                                <p className="text-destructive">
                                    Không tải được danh sách sản phẩm
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="mt-2"
                                    onClick={() =>
                                        void medicinesQuery.refetch()
                                    }
                                >
                                    Thử lại
                                </Button>
                            </div>
                        ) : medicinesQuery.isPending ? (
                            <p className="text-muted-foreground px-2 py-5 text-center text-sm">
                                Đang tải sản phẩm...
                            </p>
                        ) : results.length ? (
                            results.map((medicine, index) => (
                                <button
                                    key={medicine.id}
                                    id={`${listId}-${medicine.id}`}
                                    type="button"
                                    role="option"
                                    tabIndex={-1}
                                    aria-selected={medicine.id === value?.id}
                                    aria-disabled={!medicine.isActive}
                                    disabled={!medicine.isActive}
                                    onMouseEnter={() => setActiveIndex(index)}
                                    onClick={() => choose(medicine)}
                                    className={cn(
                                        'flex w-full items-start gap-2 rounded-sm px-2 py-2 text-left text-sm outline-none disabled:cursor-not-allowed disabled:opacity-60',
                                        index === activeIndex && 'bg-muted'
                                    )}
                                >
                                    <Check
                                        className={cn(
                                            'mt-0.5 size-4 shrink-0',
                                            medicine.id !== value?.id &&
                                                'invisible'
                                        )}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block truncate font-medium">
                                            {medicine.name}
                                        </span>
                                        <span className="text-muted-foreground block truncate text-xs">
                                            {medicine.code}
                                            {medicine.barcode
                                                ? ` · ${medicine.barcode}`
                                                : ''}
                                            {medicine.isActive
                                                ? ` · Tồn ${formatNumber(medicine.availableStock)} ${medicine.baseUnitName.toLowerCase()}`
                                                : ' · Đã ngừng bán, kích hoạt lại trong Danh mục sản phẩm'}
                                        </span>
                                    </span>
                                </button>
                            ))
                        ) : (
                            <p className="text-muted-foreground px-2 py-5 text-center text-sm break-words">
                                {search.trim()
                                    ? `Không tìm thấy “${search.trim()}” trong quầy`
                                    : 'Quầy chưa có sản phẩm nào'}
                            </p>
                        )}
                    </div>
                    <div className="border-border mt-2 border-t pt-2">
                        <Button
                            type="button"
                            variant={
                                !isSearching &&
                                !results.length &&
                                medicinesQuery.isSuccess
                                    ? 'default'
                                    : 'ghost'
                            }
                            className="w-full justify-start"
                            onClick={createNew}
                        >
                            <PackagePlus />
                            <span className="truncate">
                                {search.trim()
                                    ? `Nhập sản phẩm mới “${search.trim()}”`
                                    : 'Nhập sản phẩm mới'}
                            </span>
                        </Button>
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
