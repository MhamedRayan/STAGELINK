import { useEffect, useState } from 'react';
import { normalizeError } from '@/lib/errors';
import { Button } from './Button';
import { Field } from './Field';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

interface ReasonDialogProps {
  open: boolean;
  onClose(): void;
  title: string;
  label: string;
  confirmLabel: string;
  required?: boolean;
  onConfirm(reason: string): Promise<void>;
}

/** Modal with a free-text reason; keeps itself open and shows the API error when onConfirm rejects. */
export function ReasonDialog({
  open,
  onClose,
  title,
  label,
  confirmLabel,
  required = false,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason('');
    setError(null);
    setIsPending(false);
  }, [open]);

  const close = () => {
    if (!isPending) onClose();
  };

  const confirm = async () => {
    const value = reason.trim();
    if (required && !value) {
      setError('A reason is required.');
      return;
    }
    setIsPending(true);
    setError(null);
    try {
      await onConfirm(value);
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
          <Button variant="destructive" onClick={() => void confirm()} isLoading={isPending}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <Field label={label} error={error ?? undefined}>
        <Textarea
          rows={3}
          value={reason}
          hasError={Boolean(error)}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Explain the decision so the account holder can act on it."
        />
      </Field>
    </Modal>
  );
}
