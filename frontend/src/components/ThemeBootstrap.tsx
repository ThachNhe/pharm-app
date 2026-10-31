import { useEffect } from 'react';
import { useResolvedTheme } from '@/hooks/useResolvedTheme';
import { useUIStore } from '@/stores/useUIStore';

export function ThemeBootstrap() {
    const palette = useUIStore((state) => state.palette);
    const resolvedTheme = useResolvedTheme();

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle('dark', resolvedTheme === 'dark');
        root.style.colorScheme = resolvedTheme;
        root.dataset.palette = palette;
    }, [palette, resolvedTheme]);

    return null;
}
