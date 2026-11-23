import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';

export function PlaceholderPage({
  title,
  subtitle,
  note,
}: {
  title: string;
  subtitle?: string;
  note?: string;
}) {
  return (
    <div>
      <PageHeader title={title} subtitle={subtitle} />
      <Card className="py-14 text-center">
        <p className="text-sm font-semibold text-forest-900">This screen is being built</p>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
          {note ??
            'The route and access control are in place. The full page will follow the frozen design plan.'}
        </p>
        <Link to="/offers" className="mt-5 inline-block text-sm font-semibold text-forest-900 underline">
          Browse public offers
        </Link>
      </Card>
    </div>
  );
}
