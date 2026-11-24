import { useOfferLocations } from '../hooks';

export interface OfferFilterValue {
  search: string;
  location: string;
}

/** Search (600×40) + location filter (200×40) — Figma 24:29 / 24:31. */
export function OfferFilters({ value, onChange }: { value: OfferFilterValue; onChange: (next: OfferFilterValue) => void }) {
  const { data: locations = [] } = useOfferLocations();
  const options = value.location && !locations.includes(value.location) ? [value.location, ...locations] : locations;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:gap-5">
      <input
        type="search"
        aria-label="Search offers"
        placeholder="Search offers..."
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        className="h-10 w-full rounded-[10px] border border-line bg-mint px-5 text-[13px] text-forest-900 placeholder:text-muted sm:w-[600px] sm:max-w-full"
      />
      <div className="relative h-10 w-full shrink-0 rounded-[10px] border border-line bg-mint focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-surface-600 sm:w-[200px]">
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center whitespace-pre px-5 text-[13px] text-forest-900">
          {`${value.location || 'All Places'}  ▾`}
        </span>
        <select
          aria-label="Filter by location"
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        >
          <option value="">All Places</option>
          {options.map((location) => (
            <option key={location} value={location}>
              {location}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
