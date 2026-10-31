import {
    Check,
    Monitor,
    Moon,
    Palette as PaletteIcon,
    Sun,
} from 'lucide-react';
import { Popover } from 'radix-ui';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore, type Palette, type Theme } from '@/stores/useUIStore';

const themeOptions: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: 'light', label: 'Sáng', icon: Sun },
    { value: 'dark', label: 'Tối', icon: Moon },
    { value: 'system', label: 'Hệ thống', icon: Monitor },
];

const paletteOptions: Array<{
    value: Palette;
    label: string;
    swatch: [string, string];
}> = [
    { value: 'green', label: 'Xanh lá', swatch: ['#2E4F32', '#7ED957'] },
    { value: 'blue', label: 'Xanh dương', swatch: ['#0B3D7A', '#2EE6B6'] },
];

export function ThemeSwitcher({ className }: { className?: string }) {
    const { theme, setTheme, palette, setPalette } = useUIStore();

    return (
        <Popover.Root>
            <Popover.Trigger asChild>
                <Button
                    size="icon"
                    variant="ghost"
                    className={className}
                    aria-label="Đổi giao diện"
                    title="Đổi giao diện"
                >
                    <PaletteIcon />
                </Button>
            </Popover.Trigger>
            <Popover.Portal>
                <Popover.Content
                    align="end"
                    sideOffset={8}
                    collisionPadding={16}
                    className="border-border bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-xl outline-none"
                >
                    <p className="text-sm font-extrabold">Giao diện</p>

                    <fieldset className="mt-3">
                        <legend className="text-muted-foreground text-xs font-bold">
                            Chế độ
                        </legend>
                        <div className="bg-muted mt-2 grid grid-cols-3 gap-1 rounded-xl p-1">
                            {themeOptions.map(
                                ({ value, label, icon: Icon }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={theme === value}
                                        onClick={() => setTheme(value)}
                                        className={cn(
                                            'focus-visible:ring-ring flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-bold transition-colors outline-none focus-visible:ring-2',
                                            theme === value
                                                ? 'bg-card text-foreground shadow-sm'
                                                : 'text-muted-foreground hover:text-foreground'
                                        )}
                                    >
                                        <Icon className="size-3.5" />
                                        {label}
                                    </button>
                                )
                            )}
                        </div>
                    </fieldset>

                    <fieldset className="mt-4">
                        <legend className="text-muted-foreground text-xs font-bold">
                            Màu chủ đạo
                        </legend>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {paletteOptions.map(
                                ({
                                    value,
                                    label,
                                    swatch: [deep, highlight],
                                }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        aria-pressed={palette === value}
                                        onClick={() => setPalette(value)}
                                        className={cn(
                                            'focus-visible:ring-ring flex items-center gap-2 rounded-xl border p-2 text-left text-xs font-bold transition-colors outline-none focus-visible:ring-2',
                                            palette === value
                                                ? 'border-primary bg-secondary'
                                                : 'border-border hover:bg-accent'
                                        )}
                                    >
                                        <span
                                            className="relative size-7 shrink-0 overflow-hidden rounded-full"
                                            style={{ backgroundColor: deep }}
                                            aria-hidden="true"
                                        >
                                            <span
                                                className="absolute right-0 bottom-0 size-3.5 rounded-tl-full"
                                                style={{
                                                    backgroundColor: highlight,
                                                }}
                                            />
                                        </span>
                                        <span className="min-w-0 flex-1 whitespace-nowrap">
                                            {label}
                                        </span>
                                        {palette === value ? (
                                            <Check className="text-primary size-4" />
                                        ) : null}
                                    </button>
                                )
                            )}
                        </div>
                    </fieldset>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
}
