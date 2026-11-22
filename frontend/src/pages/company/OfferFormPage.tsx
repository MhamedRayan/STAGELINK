import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { offersApi } from '@/lib/api/offers';
import { useOffer } from '@/lib/queries';
import { toDateTimeInput } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  LoadingBlock,
  PageHeader,
  Textarea,
} from '@/components/ui';

const schema = z.object({
  title: z.string().min(1, 'Enter a title').max(200, 'Keep the title under 200 characters'),
  location: z.string().min(1, 'Enter a location').max(255, 'Keep the location under 255 characters'),
  description: z.string().min(1, 'Describe the internship'),
  requirements: z.string(),
  deadline: z
    .string()
    .min(1, 'Choose a deadline')
    .refine((value) => new Date(value).getTime() > Date.now(), 'The deadline must be in the future'),
  capacity: z.coerce.number().int('Use a whole number').min(1, 'At least one place'),
});

type FormValues = z.infer<typeof schema>;

export function OfferFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useOffer(mode === 'edit' ? offerId : undefined);
  const [formError, setFormError] = useState<string | null>(null);
  const intentRef = useRef<'save' | 'publish'>('save');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: '',
      location: '',
      description: '',
      requirements: '',
      deadline: '',
      capacity: 1,
    },
  });

  useEffect(() => {
    if (mode === 'edit' && existing.data) {
      reset({
        title: existing.data.title,
        location: existing.data.location,
        description: existing.data.description,
        requirements: existing.data.requirements,
        deadline: toDateTimeInput(existing.data.deadline),
        capacity: existing.data.capacity,
      });
    }
  }, [mode, existing.data, reset]);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const intent = intentRef.current;
    const payload = {
      title: values.title,
      location: values.location,
      description: values.description,
      requirements: values.requirements,
      deadline: new Date(values.deadline).toISOString(),
      capacity: values.capacity,
    };

    try {
      if (mode === 'create') {
        const created = await offersApi.create(payload);
        if (intent === 'publish') {
          await offersApi.publish(created.id);
          toast.success('Offer published.');
        } else {
          toast.success('Draft offer saved.');
        }
      } else {
        await offersApi.update(offerId as string, payload);
        if (intent === 'publish') {
          await offersApi.publish(offerId as string);
          toast.success('Offer updated and published.');
        } else {
          toast.success('Offer updated.');
        }
      }
      navigate('/app/company/offers');
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : 'Could not save the offer.');
    }
  }

  if (mode === 'edit' && existing.isLoading) return <LoadingBlock label="Loading offer…" />;
  if (mode === 'edit' && (existing.isError || !existing.data)) {
    return <ErrorState message="This offer could not be loaded." onRetry={() => void existing.refetch()} />;
  }

  return (
    <div>
      <Link
        to="/app/company/offers"
        className="mb-5 inline-flex text-sm font-semibold text-muted hover:text-forest-900"
      >
        ← Back to my offers
      </Link>
      <PageHeader
        title={mode === 'create' ? 'Post New Internship Offer' : 'Edit Internship Offer'}
        subtitle="Students see this information before applying."
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-3 gap-6">
          <Card className="col-span-2">
            <div className="space-y-4">
              <Field label="Internship title" htmlFor="offer-title" error={errors.title?.message} required>
                <Input id="offer-title" placeholder="Software Engineering Intern" {...register('title')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Location" htmlFor="offer-location" error={errors.location?.message} required>
                  <Input id="offer-location" placeholder="Algiers" {...register('location')} />
                </Field>
                <Field
                  label="Number of places"
                  htmlFor="offer-capacity"
                  error={errors.capacity?.message}
                  required
                >
                  <Input id="offer-capacity" type="number" min={1} {...register('capacity')} />
                </Field>
              </div>
              <Field
                label="Description"
                htmlFor="offer-description"
                error={errors.description?.message}
                required
              >
                <Textarea
                  id="offer-description"
                  className="min-h-40"
                  placeholder="Describe the mission, team and what the student will learn."
                  {...register('description')}
                />
              </Field>
              <Field
                label="Required skills"
                htmlFor="offer-requirements"
                error={errors.requirements?.message}
              >
                <Textarea
                  id="offer-requirements"
                  placeholder="React, TypeScript, communication…"
                  {...register('requirements')}
                />
              </Field>
            </div>
          </Card>

          <div className="space-y-6">
            <Card muted>
              <Field
                label="Application deadline"
                htmlFor="offer-deadline"
                error={errors.deadline?.message}
                hint="Displayed to students as dd/mm/yyyy."
                required
              >
                <Input id="offer-deadline" type="datetime-local" {...register('deadline')} />
              </Field>
            </Card>

            <Card>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Lifecycle
              </h2>
              <p className="mt-3 text-xs leading-relaxed text-muted">
                New offers start as drafts. Publish when the details are ready; published offers
                can be closed at any time. Only drafts can be deleted.
              </p>
            </Card>

            {formError && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-danger">
                {formError}
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button
            type="submit"
            disabled={isSubmitting}
            onClick={() => {
              intentRef.current = mode === 'create' ? 'publish' : 'save';
            }}
          >
            {isSubmitting
              ? 'Saving…'
              : mode === 'create'
                ? 'Create offer'
                : 'Save changes'}
          </Button>
          {(mode === 'create' || existing.data?.status === 'draft') && (
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmitting}
              onClick={() => {
                intentRef.current = mode === 'create' ? 'save' : 'publish';
              }}
            >
              {isSubmitting ? 'Saving…' : mode === 'create' ? 'Save as draft' : 'Save & publish'}
            </Button>
          )}
          <Link to="/app/company/offers" className="ml-2 text-sm text-muted hover:text-forest-900">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
