import { useEffect, useState } from 'react';
import { normalizeError } from '@/lib/errors';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm(): Promise<void>;
}

/** Yes/no modal for an action that needs no extra input; keeps itself open on failure. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setIsPending(false);
  }, [open]);

  const close = () => {
    if (!isPending) onClose();
  };

  const confirm = async () => {
    setIsPending(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(normalizeError(caught).message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={close} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'primary'}
            onClick={() => void confirm()}
            isLoading={isPending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-5 text-muted">{message}</p>
      {error && (
        <p role="alert" className="mt-3 text-[12px] text-pill-danger-fg">
          {error}
        </p>
      )}
    </Modal>
  );
}
