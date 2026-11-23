import { z } from 'zod';

/** Company offer form — design-plan §3.3 validation rules. */
export const offerFormSchema = z.object({
  title: z.string().trim().min(1, 'A title is required.').max(200, 'Use at most 200 characters.'),
  location: z.string().trim().min(1, 'A location is required.').max(255, 'Use at most 255 characters.'),
  capacity: z.coerce
    .number()
    .int('Capacity must be a whole number.')
    .min(1, 'Capacity must be at least one place.'),
  deadline: z.string().min(1, 'An application deadline is required.'),
  description: z.string().trim().min(1, 'A description is required.'),
  requirements: z.string().trim(),
});

export type OfferFormValues = z.infer<typeof offerFormSchema>;
