import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { apiRequest, ApiError } from '../../api/client';
import { SectionCard } from '../../components/ui/SectionCard';
import { Button } from '../../components/ui/Button';
import { Input, Textarea } from '../../components/ui/Input';

interface OfferFormState {
  title: string;
  location: string;
  capacity: number;
  deadline: string;
  description: string;
  requirements: string;
}

export const CompanyPostInternship: React.FC = () => {
  const { offerId } = useParams<{ offerId: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(offerId);

  const [form, setForm] = useState<OfferFormState>({
    title: '',
    location: '',
    capacity: 1,
    deadline: '',
    description: '',
    requirements: '',
  });

  const [isLoading, setIsLoading] = useState<boolean>(isEditMode);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  // If edit mode, load existing offer
  useEffect(() => {
    let isMounted = true;
    async function loadOffer() {
      if (!offerId) return;
      setIsLoading(true);
      try {
        const data = await apiRequest<any>(`/svc/offers/api/offers/${offerId}/`);
        if (isMounted) {
          // Format ISO deadline to datetime-local format (YYYY-MM-DDTHH:mm)
          let formattedDeadline = '';
          if (data.deadline) {
            const d = new Date(data.deadline);
            formattedDeadline = d.toISOString().slice(0, 16);
          }

          setForm({
            title: data.title || '',
            location: data.location || '',
            capacity: data.capacity || 1,
            deadline: formattedDeadline,
            description: data.description || '',
            requirements: data.requirements || '',
          });
        }
      } catch (err: any) {
        if (isMounted) setGeneralError(err.message || 'Failed to load offer.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadOffer();
    return () => {
      isMounted = false;
    };
  }, [offerId]);

  const handleSubmit = async (publishImmediately: boolean = false) => {
    setGeneralError(null);
    setFieldErrors({});

    // Validate deadline is future
    if (new Date(form.deadline) <= new Date()) {
      setFieldErrors({ deadline: ['Application deadline must be in the future.'] });
      return;
    }

    if (form.capacity < 1) {
      setFieldErrors({ capacity: ['Capacity must be at least 1 place.'] });
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        title: form.title,
        location: form.location,
        capacity: Number(form.capacity),
        deadline: new Date(form.deadline).toISOString(),
        description: form.description,
        requirements: form.requirements || undefined,
      };

      if (isEditMode) {
        await apiRequest(`/svc/offers/api/offers/${offerId}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        const created = await apiRequest<{ id: string }>('/svc/offers/api/offers/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

        if (publishImmediately) {
          try {
            await apiRequest(`/svc/offers/api/offers/${created.id}/publish/`, {
              method: 'POST',
            });
          } catch (pubErr: any) {
            console.error('Created but publishing failed:', pubErr);
          }
        }
      }

      navigate('/app/company/offers');
    } catch (err: any) {
      if (err instanceof ApiError) {
        if (err.fieldErrors) {
          setFieldErrors(err.fieldErrors);
        } else {
          setGeneralError(err.message);
        }
      } else {
        setGeneralError('Failed to save internship offer.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-20 flex justify-center items-center">
        <div className="w-8 h-8 border-3 border-surface-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/company/offers"
        className="inline-flex items-center text-xs font-semibold text-surface-700 hover:underline"
      >
        <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to My Offers
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-forest-900 tracking-tight">
          {isEditMode ? 'Edit Internship Offer' : 'Post New Internship Offer'}
        </h1>
        <p className="text-xs text-mutedText mt-1">
          {isEditMode
            ? 'Update the details or intake capacity of your internship listing.'
            : 'Create an opportunity for students. Save as draft or publish immediately to open applications.'}
        </p>
      </div>

      {generalError && (
        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{generalError}</span>
        </div>
      )}

      <div className="space-y-6">
        <SectionCard title="Basic Position Details">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Internship Title"
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Full-Stack Software Engineering Intern"
                error={fieldErrors.title?.[0]}
              />
            </div>

            <Input
              label="Workplace Location"
              required
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="e.g. Algiers (Hybrid / On-site)"
              error={fieldErrors.location?.[0]}
            />

            <Input
              label="Available Places (Capacity)"
              type="number"
              min={1}
              required
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value, 10) || 1 })}
              error={fieldErrors.capacity?.[0]}
            />

            <div className="md:col-span-2">
              <Input
                label="Application Deadline"
                type="datetime-local"
                required
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                error={fieldErrors.deadline?.[0]}
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Description & Skill Requirements">
          <div className="space-y-4">
            <Textarea
              label="Role Description & Project Objectives"
              required
              rows={4}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Detail the missions, team structure, and projects the student will work on..."
              error={fieldErrors.description?.[0]}
            />

            <Textarea
              label="Required Skills & Desired Qualifications"
              rows={3}
              value={form.requirements}
              onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              placeholder="e.g. React, TypeScript, Python / Django, Git, team communication..."
              error={fieldErrors.requirements?.[0]}
            />
          </div>
        </SectionCard>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-mint-200">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/app/company/offers')}
          >
            Cancel
          </Button>

          {isEditMode ? (
            <Button
              type="button"
              onClick={() => handleSubmit(false)}
              isLoading={isSubmitting}
            >
              Save Changes
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleSubmit(false)}
                isLoading={isSubmitting}
              >
                Save as Draft
              </Button>
              <Button
                type="button"
                onClick={() => handleSubmit(true)}
                isLoading={isSubmitting}
              >
                Create & Publish
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
