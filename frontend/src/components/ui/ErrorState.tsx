import { normalizeError } from '@/lib/errors';
import { Button } from './Button';

/** Full-block error for a failed page load. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = normalizeError(error);
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-panel border border-line bg-mint px-6 py-12 text-center">
      <p className="text-[16px] font-semibold text-forest-900">
        {apiError.status === 404 ? 'Not found' : 'Something went wrong'}
      </p>
      <p className="max-w-[420px] text-[13px] text-muted">{apiError.message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
