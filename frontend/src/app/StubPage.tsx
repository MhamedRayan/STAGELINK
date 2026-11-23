import { useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/Card';

interface StubPageProps {
  /** Component name this stub stands for, e.g. "StudentDashboardPage". */
  name: string;
  /** design-plan section, e.g. "§3.2 Student › Dashboard". */
  plan: string;
  /** Figma frame node id, e.g. "25:2". */
  figma: string;
}

/** Placeholder for a not-yet-built screen. Replace the whole page file; never edit the router. */
export function StubPage({ name, plan, figma }: StubPageProps) {
  const { pathname } = useLocation();
  return (
    <Card tone="mint" className="max-w-content space-y-2">
      <h1 className="text-page-title text-forest-900">{name}</h1>
      <p className="text-muted">Not built yet.</p>
      <p>
        Route <code>{pathname}</code> · Plan {plan} · Figma frame <code>{figma}</code>
      </p>
    </Card>
  );
}
