import { useState } from 'react';
import { useDebounce } from '@/hooks/useDebounce';

export function usePaginatedSearch(delay = 350) {
    const [search, setSearchValue] = useState('');
    const [page, setPage] = useState(1);
    const debouncedSearch = useDebounce(search, delay);

    const setSearch = (value: string) => {
        setSearchValue(value);
        setPage(1);
    };

    return { search, setSearch, debouncedSearch, page, setPage };
}
