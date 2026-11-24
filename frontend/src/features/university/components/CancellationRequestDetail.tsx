import { useEffect, useState } from 'react';
import { Button, Textarea, useToast } from '@/components/ui';
import { useOfferTitle } from '@/features/directory/offers';
import { useUserLabel } from '@/features/directory/users';
import { normalizeError } from '@/lib/errors';
import { useApproveCancellation, useRejectCancellation } from '../hooks';
import type { UniversityCancellationRow } from '../hooks';
import { S } from '../strings';

interface CancellationRequestDetailProps {
  row: UniversityCancellationRow | null;
  onDecided(): void;
}

/** Figma 28:1215 detail panel: explicit selection, inline reason, no extra modal. */
export function CancellationRequestDetail({ row, onDecided }: CancellationRequestDetailProps) {
  const toast = useToast();
  const approve = useApproveCancellation();
  const reject = useRejectCancellation();
  const [reason, setReason] = useState('');
  const offerTitle = useOfferTitle(row?.internship.offer_id);
  const requester = useUserLabel(
    row?.request.requested_by_user_id,
    row?.request.requested_by_role ?? 'student',
  );
  const isPending = approve.isPending || reject.isPending;

  useEffect(() => {
    setReason('');
  }, [row?.request.id]);

  const onApprove = async () => {
    if (!row) return;
    try {
      await approve.mutateAsync({
        internshipId: row.internship.id,
        requestId: row.request.id,
      });
      toast.success(S.cancellations.approved);
      onDecided();
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  const onReject = async () => {
    if (!row || !reason.trim()) return;
    try {
      await reject.mutateAsync({
        internshipId: row.internship.id,
        requestId: row.request.id,
        reason: reason.trim(),
      });
      toast.success(S.cancellations.rejected);
      setReason('');
      onDecided();
    } catch (error) {
      toast.error(normalizeError(error).message);
    }
  };

  return (
    <aside className="h-[640px] w-full max-w-[440px] rounded-panel bg-mint p-5">
      <h2 className="text-[16px] font-semibold text-forest-900">{S.cancellations.detailTitle}</h2>
      {!row ? (
        <p className="mt-4 text-[13px] text-muted">{S.cancellations.selectPrompt}</p>
      ) : (
        <>
          <p className="mt-4 text-[13px] font-medium text-forest-900">
            {`${offerTitle}  •  ${requester}`}
          </p>
          <p className="mt-4 text-[13px] font-medium text-forest-900">
            {S.cancellations.reasonLabel}
          </p>
          <div className="mt-2 h-[100px] w-full rounded-[10px] border border-line bg-canvas px-3.5 py-3">
            <p className="text-[13px] leading-5 text-forest-900">{row.request.reason}</p>
          </div>
          {row.request.status === 'pending' ? (
            <>
              <Button
                className="mt-9 h-10 w-full rounded-[10px]"
                onClick={() => void onApprove()}
                isLoading={approve.isPending}
                disabled={isPending}
              >
                {S.cancellations.approve}
              </Button>
              <p className="mt-5 text-[13px] font-medium text-forest-900">
                {S.cancellations.rejectReasonLabel}
              </p>
              <Textarea
                className="mt-2 h-[70px] w-full rounded-[10px]"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={S.cancellations.rejectPlaceholder}
                disabled={isPending}
                aria-label={S.cancellations.rejectReasonLabel}
              />
              <Button
                variant="destructive"
                className="mt-[22px] h-10 w-full rounded-[10px] border border-pill-danger-fg bg-pill-danger-bg font-medium text-pill-danger-fg hover:bg-pill-danger-bg/80"
                onClick={() => void onReject()}
                isLoading={reject.isPending}
                disabled={!reason.trim() || isPending}
              >
                {S.cancellations.reject}
              </Button>
            </>
          ) : (
            <p className="mt-9 text-[13px] text-muted">{S.common.processed}</p>
          )}
        </>
      )}
    </aside>
  );
}
