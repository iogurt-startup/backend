import { z } from 'zod'
import { onlyDigits } from '@shared/documents'

export const tutorAlternateContactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z
    .string()
    .transform(onlyDigits)
    .refine((phone) => phone.length >= 10 && phone.length <= 11, {
      message: 'Telefone deve conter 10 ou 11 dígitos',
    }),
  relationship: z.string().trim().min(2).max(60),
  hasWhatsApp: z.boolean(),
})

export const tutorAlternateContactsSchema = z.array(tutorAlternateContactSchema).max(2)

export type TutorAlternateContact = z.infer<typeof tutorAlternateContactSchema>
