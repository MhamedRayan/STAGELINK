import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

interface SearchContextValue {
  search: string;
  setSearch: (value: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState('');
  const location = useLocation();

  useEffect(() => {
    setSearch('');
  }, [location.pathname]);

  const value = useMemo(() => ({ search, setSearch }), [search]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function usePageSearch(): SearchContextValue {
  const context = useContext(SearchContext);
  if (!context) throw new Error('usePageSearch must be used inside SearchProvider');
  return context;
}
