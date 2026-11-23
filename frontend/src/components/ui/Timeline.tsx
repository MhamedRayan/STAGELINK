interface TimelineItem {
  id: string;
  title: string;
  meta?: string;
  body?: string;
}

interface TimelineProps {
  items: TimelineItem[];
}

/** Vertical status history; meta is expected to be an already-formatted date/time string. */
export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="relative space-y-5 pl-6">
      <span aria-hidden="true" className="absolute bottom-2 left-[5px] top-2 w-px bg-line" />
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            aria-hidden="true"
            className="absolute -left-6 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-surface-600 bg-canvas"
          />
          <p className="text-[13px] font-semibold text-forest-900">{item.title}</p>
          {item.meta && <p className="mt-0.5 text-[11px] text-muted">{item.meta}</p>}
          {item.body && <p className="mt-1 text-[13px] leading-5 text-ink">{item.body}</p>}
        </li>
      ))}
    </ol>
  );
}
