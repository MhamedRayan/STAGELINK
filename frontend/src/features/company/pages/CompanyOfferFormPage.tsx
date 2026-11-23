import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import {
  Button,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Skeleton,
  Textarea,
  useToast,
} from '@/components/ui';
import { normalizeError } from '@/lib/errors';
import { useCompanyOffer, useCreateOffer, usePublishOffer, useUpdateOffer } from '../hooks';
import { offerFormSchema, type OfferFormValues } from '../schemas';
import { S } from '../strings';

/** Company Post/Edit Internship — Figma 26:525. */
export function CompanyOfferFormPage() {
  const { offerId } = useParams();
  const isEditMode = Boolean(offerId);
  const navigate = useNavigate();
  const toast = useToast();
  const offer = useCompanyOffer(offerId);
  const create = useCreateOffer();
  const update = useUpdateOffer();
  const publish = usePublishOffer();
  const [generalError, setGeneralError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<OfferFormValues>({
    resolver: zodResolver(offerFormSchema),
    defaultValues: {
      title: '',
      location: '',
      capacity: 1,
      deadline: '',
      description: '',
      requirements: '',
    },
  });

  useEffect(() => {
    if (!isEditMode || !offer.data) return;
    reset({
      title: offer.data.title,
      location: offer.data.location,
      capacity: offer.data.capacity,
      deadline: offer.data.deadline.slice(0, 16),
      description: offer.data.description,
      requirements: offer.data.requirements,
    });
  }, [isEditMode, offer.data, reset]);

  if (isEditMode && offer.isError) {
    return <ErrorState error={offer.error} onRetry={() => void offer.refetch()} />;
  }
  if (isEditMode && offer.isLoading) {
    return <Skeleton className="h-[640px] rounded-panel" />;
  }

  const toBody = (values: OfferFormValues) => ({
    title: values.title.trim(),
    location: values.location.trim(),
    capacity: values.capacity,
    deadline: new Date(values.deadline).toISOString(),
    description: values.description.trim(),
    requirements: values.requirements.trim(),
  });

  const perform = async (values: OfferFormValues, shouldPublish: boolean) => {
    setGeneralError(null);
    if (new Date(values.deadline).getTime() <= Date.now()) {
      setError('deadline', { message: S.form.deadlineFuture });
      return;
    }
    const body = toBody(values);
    try {
      if (isEditMode && offerId) {
        await update.mutateAsync({ id: offerId, body });
        toast.success(S.form.updated);
      } else {
        const created = await create.mutateAsync(body);
        if (shouldPublish) {
          await publish.mutateAsync(created.id);
          toast.success(S.form.published);
        } else {
          toast.success(S.form.saved);
        }
      }
      navigate(ROUTES.company.offers);
    } catch (caught) {
      const apiError = normalizeError(caught);
      for (const [field, message] of Object.entries(apiError.fieldErrors)) {
        if (field in values) setError(field as keyof OfferFormValues, { message });
      }
      setGeneralError(apiError.message);
    }
  };

  const onPublishSubmit = handleSubmit((values) => perform(values, true));
  const onDraftSubmit = handleSubmit((values) => perform(values, false));

  return (
    <div className="max-w-content">
      <Link
        to={ROUTES.company.offers}
        className="text-[13px] font-medium text-surface-600 hover:underline"
      >
        ← {S.form.back}
      </Link>

      <div className="mt-3">
        <PageHeader
          title={isEditMode ? S.form.editTitle : S.form.newTitle}
          subtitle={isEditMode ? S.form.editSubtitle : S.form.newSubtitle}
        />
      </div>

      {generalError && (
        <p role="alert" className="mt-4 rounded-card border border-line bg-mint px-4 py-3 text-[13px] text-pill-danger-fg">
          {generalError}
        </p>
      )}

      <form onSubmit={(event) => void onPublishSubmit(event)} noValidate>
        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.form.basicsTitle}</h2>
          <div className="mt-4 grid grid-cols-2 gap-x-[42px] gap-y-4">
            <Field label={S.form.titleLabel} error={errors.title?.message}>
              <Input
                {...register('title')}
                hasError={Boolean(errors.title)}
                placeholder={S.form.titlePlaceholder}
              />
            </Field>
            <Field label={S.form.locationLabel} error={errors.location?.message}>
              <Input
                {...register('location')}
                hasError={Boolean(errors.location)}
                placeholder={S.form.locationPlaceholder}
              />
            </Field>
            <Field label={S.form.capacityLabel} error={errors.capacity?.message}>
              <Input type="number" min={1} step={1} {...register('capacity')} hasError={Boolean(errors.capacity)} />
            </Field>
            <Field label={S.common.deadline} error={errors.deadline?.message}>
              <Input type="datetime-local" {...register('deadline')} hasError={Boolean(errors.deadline)} />
            </Field>
          </div>
        </section>

        <section className="mt-5 rounded-panel border border-line bg-mint p-5">
          <h2 className="text-[16px] font-semibold text-forest-900">{S.form.descriptionTitle}</h2>
          <div className="mt-4 space-y-4">
            <Field label={S.form.descriptionLabel} error={errors.description?.message}>
              <Textarea
                rows={4}
                {...register('description')}
                hasError={Boolean(errors.description)}
                placeholder={S.form.descriptionPlaceholder}
              />
            </Field>
            <Field label={S.form.requirementsLabel} error={errors.requirements?.message}>
              <Textarea
                rows={3}
                {...register('requirements')}
                hasError={Boolean(errors.requirements)}
                placeholder={S.form.requirementsPlaceholder}
              />
            </Field>
          </div>
        </section>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to={ROUTES.company.offers}>
            <Button variant="secondary" type="button">
              {S.common.cancel}
            </Button>
          </Link>
          {isEditMode ? (
            <Button type="submit" isLoading={isSubmitting || update.isPending}>
              {S.form.saveChanges}
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                type="button"
                isLoading={isSubmitting || create.isPending}
                onClick={() => void onDraftSubmit()}
              >
                {S.form.saveDraft}
              </Button>
              <Button type="submit" isLoading={isSubmitting || create.isPending || publish.isPending}>
                {S.form.createPublish}
              </Button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
