import { forwardRef, type InputHTMLAttributes } from 'react';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  /** md = label 8 px above the 40 px input (64 px block), sm = 6 px (62 px block). */
  controlGap?: 'sm' | 'md';
}

/** Label + 40 px input exactly as drawn in the profile frames (radius 8, 13 px text, 14 px inset). */
export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, controlGap = 'md', ...inputProps },
  ref,
) {
  return (
    <Field label={label} error={error} controlGap={controlGap}>
      <Input ref={ref} hasError={Boolean(error)} className="h-10 px-3.5 text-[13px]" {...inputProps} />
    </Field>
  );
});
