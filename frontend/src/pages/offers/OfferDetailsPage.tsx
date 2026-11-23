import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/lib/auth/AuthContext';
import { ApiError } from '@/lib/api/client';
import { applicationsApi } from '@/lib/api/applications';
import { useApplications, useCompanyProfile, useOffer } from '@/lib/queries';
import { addDays, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  Modal,
  StatusPill,
} from '@/components/ui';
import { offerStatuses, statusMeta } from '@/lib/status';

const applySchema = z
  .object({
    start_date: z.string().min(1, 'Choose a start date'),
    end_date: z.string().min(1, 'Choose an end date'),
  })
  .refine((values) => values.end_date > values.start_date, {
    path: ['end_date'],
    message: 'The end date must be after the start date',
  });

type ApplyValues = z.infer<typeof applySchema>;

export function OfferDetailsPage({ mode }: { mode: 'guest' | 'student' }) {
  const { offerId } = useParams<{ offerId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: offer, isLoading, isError, error, refetch } = useOffer(offerId);
  const { data: company } = useCompanyProfile(offer?.company_user_id);
  const isStudent = mode === 'student' && user?.role === 'student';
  const { data: existing } = useApplications(
    { offer_id: offerId, limit: 1 },
    isStudent && Boolean(offerId),
  );
  const alreadyApplied = isStudent && Boolean(existing?.results.length);
  const [applyOpen, setApplyOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const deadlinePassed = useMemo(() => {
    if (!offer?.deadline) return false;
    return new Date(offer.deadline).getTime() < Date.now();
  }, [offer?.deadline]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ApplyValues>({
    resolver: zodResolver(applySchema),
    defaultValues: { start_date: addDays(30), end_date: addDays(120) },
  });

  async function onApply(values: ApplyValues) {
    if (!offer) return;
    setSubmitError(null);
    try {
      await applicationsApi.create({
        offer_id: offer.id,
        start_date: values.start_date,
        end_date: values.end_date,
      });
      toast.success('Application submitted.');
      setApplyOpen(false);
      reset();
      navigate('/app/student/applications');
    } catch (caught) {
      if (caught instanceof ApiError) {
        setSubmitError(caught.message);
      } else {
        setSubmitError('Unable to submit the application right now.');
      }
    }
  }

  if (isLoading) return <LoadingBlock label="Loading offer…" />;
  if (isError || !offer) {
    return (
      <ErrorState
        message={error instanceof Error ? error.message : 'This offer could not be found.'}
        onRetry={() => void refetch()}
      />
    );
  }

  const canApply = offer.status === 'published' && !deadlinePassed && !alreadyApplied;
  const backTo = isStudent ? '/app/student/offers' : '/offers';

  return (
    <div>
      <Link
        to={backTo}
        className="mb-5 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to offers
      </Link>

      <div className="mb-8 flex items-start justify-between gap-8">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusPill meta={statusMeta(offerStatuses, offer.status)} />
            <span className="text-xs text-muted">
              {offer.capacity} {offer.capacity === 1 ? 'place' : 'places'} available
            </span>
          </div>
          <h1 className="text-[28px] font-bold leading-tight text-forest-900">{offer.title}</h1>
          <p className="mt-1 text-sm text-muted">
            {company?.legal_name || 'Company'} • {offer.location}
          </p>
        </div>

        <div className="shrink-0">
          {isStudent ? (
            alreadyApplied ? (
              <div className="text-right">
                <p className="text-sm font-semibold text-success">Application submitted</p>
                <Link
                  to="/app/student/applications"
                  className="text-xs font-semibold text-forest-900 underline"
                >
                  View my applications
                </Link>
              </div>
            ) : (
              <Button disabled={!canApply} onClick={() => setApplyOpen(true)}>
                Submit application
              </Button>
            )
          ) : (
            <Link to="/login">
              <Button>Log in to apply</Button>
            </Link>
          )}
        </div>
      </div>

      {isStudent && !canApply && !alreadyApplied && (
        <p className="mb-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-warning">
          {offer.status !== 'published'
            ? 'This offer is not open for applications.'
            : 'The application deadline has passed.'}
        </p>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Description</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-forest-900/80">
              {offer.description}
            </p>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-forest-900">Required skills</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-forest-900/80">
              {offer.requirements || 'No specific skills listed.'}
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card muted>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
              Dates and places
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Application deadline</dt>
                <dd className="font-semibold text-forest-900">{formatDate(offer.deadline)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Places</dt>
                <dd className="font-semibold text-forest-900">{offer.capacity}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Location</dt>
                <dd className="font-semibold text-forest-900">{offer.location}</dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Company</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted">Name</dt>
                <dd className="font-semibold text-forest-900">{company?.legal_name || 'Company'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Address</dt>
                <dd className="text-forest-900/80">{company?.address || 'Not provided'}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Website</dt>
                <dd className="truncate text-forest-900/80">
                  {company?.website ? (
                    <a
                      href={company.website}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {company.website}
                    </a>
                  ) : (
                    'Not provided'
                  )}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Modal
        open={applyOpen}
        title={`Apply — ${offer.title}`}
        onClose={() => setApplyOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="apply-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting…' : 'Submit application'}
            </Button>
          </>
        }
      >
        <form id="apply-form" className="space-y-4" onSubmit={handleSubmit(onApply)} noValidate>
          <p className="text-sm text-muted">
            The internship period helps the company and university plan the placement. You can
            discuss changes later.
          </p>
          <Field label="Start date" htmlFor="start_date" error={errors.start_date?.message} required>
            <Input id="start_date" type="date" {...register('start_date')} />
          </Field>
          <Field label="End date" htmlFor="end_date" error={errors.end_date?.message} required>
            <Input id="end_date" type="date" {...register('end_date')} />
          </Field>
          {submitError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-danger">
              {submitError}
            </p>
          )}
        </form>
      </Modal>
    </div>
  );
}
