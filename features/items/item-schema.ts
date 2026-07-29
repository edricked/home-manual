import { z } from 'zod';

const optionalText = z.string().trim().max(200).transform((value) => value || null);

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter an item name.').max(120),
  areaName: optionalText,
  category: optionalText,
  manufacturer: optionalText,
  modelNumber: optionalText,
  serialNumber: optionalText,
  notes: z.string().trim().max(4000).transform((value) => value || null),
});

export type ItemInput = z.input<typeof itemInputSchema>;
export type ParsedItemInput = z.output<typeof itemInputSchema>;
