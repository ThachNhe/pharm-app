import { useEffect, useState } from 'react';
import { useUIStore } from '@/stores/useUIStore';

const darkQuery = '(prefers-color-scheme: dark)';

export function useResolvedTheme() {
    const theme = useUIStore((state) => state.theme);
    const [systemDark, setSystemDark] = useState(
        () => window.matchMedia(darkQuery).matches
    );

    useEffect(() => {
        const media = window.matchMedia(darkQuery);
        const onChange = (event: MediaQueryListEvent) =>
            setSystemDark(event.matches);
        media.addEventListener('change', onChange);
        return () => media.removeEventListener('change', onChange);
    }, []);

    return theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;
}
