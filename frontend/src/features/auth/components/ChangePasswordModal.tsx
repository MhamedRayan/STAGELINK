import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { normalizeError } from '@/lib/errors';
import { useAuth } from '../AuthProvider';
import { useChangePassword } from '../passwordHooks';
import { changePasswordSchema, type ChangePasswordFormValues } from '../passwordSchema';
import { PW } from '../passwordStrings';
import { S } from '../strings';

const FORM_ID = 'change-password-form';

/** Change password → POST /api/users/me/password/ → local tokens cleared → /password-changed. */
export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { clearLocalSession } = useAuth();
  const mutation = useChangePassword();
  const [serverMessage, setServerMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setServerMessage(null);
    }
  }, [open, reset]);

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setServerMessage(null);
    try {
      await mutation.mutateAsync({ currentPassword, newPassword });
      // All refresh tokens are revoked server-side: leave first, then drop the local session.
      navigate(ROUTES.passwordChanged, { replace: true });
      clearLocalSession();
    } catch (error) {
      const apiError = normalizeError(error);
      const current = apiError.fieldErrors.current_password;
      const next = apiError.fieldErrors.new_password;
      if (current) setError('currentPassword', { message: current });
      if (next) setError('newPassword', { message: next });
      if (!current && !next) setServerMessage(apiError.message);
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={PW.modal.title}
      footer={
        <>
          <Button variant="secondary" className="h-10 rounded-[10px] px-5 text-[13px]" onClick={onClose}>
            {PW.modal.cancel}
          </Button>
          <Button
            type="submit"
            form={FORM_ID}
            isLoading={isSubmitting}
            className="h-10 rounded-[10px] px-5 text-[13px] font-medium"
          >
            {PW.modal.submit}
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-3.5">
        <Field label={PW.modal.current} controlGap="md" error={errors.currentPassword?.message}>
          <PasswordInput
            autoComplete="current-password"
            className="h-10 text-[13px]"
            hasError={Boolean(errors.currentPassword)}
            showLabel={S.passwordToggle.show}
            hideLabel={S.passwordToggle.hide}
            {...register('currentPassword')}
          />
        </Field>
        <Field label={PW.modal.next} controlGap="md" error={errors.newPassword?.message}>
          <PasswordInput
            autoComplete="new-password"
            className="h-10 text-[13px]"
            hasError={Boolean(errors.newPassword)}
            showLabel={S.passwordToggle.show}
            hideLabel={S.passwordToggle.hide}
            {...register('newPassword')}
          />
        </Field>
        <Field label={PW.modal.confirm} controlGap="md" error={errors.confirmPassword?.message}>
          <PasswordInput
            autoComplete="new-password"
            className="h-10 text-[13px]"
            hasError={Boolean(errors.confirmPassword)}
            showLabel={S.passwordToggle.show}
            hideLabel={S.passwordToggle.hide}
            {...register('confirmPassword')}
          />
        </Field>
        {serverMessage && (
          <p role="alert" className="text-[12px] leading-4 text-pill-danger-fg">
            {serverMessage}
          </p>
        )}
      </form>
    </Modal>
  );
}
