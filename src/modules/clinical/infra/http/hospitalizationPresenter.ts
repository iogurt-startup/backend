import { z } from 'zod'
import { HOSPITALIZATION_STATUSES } from '../../repositories/IHospitalizationsRepository'
import type {
  Hospitalization,
  HospitalizationDetails,
  HospitalizationEvolutionWithVet,
  HospitalizationWithPatient,
} from '../../repositories/IHospitalizationsRepository'

const vetSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
})

export const hospitalizationResponseSchema = z.object({
  id: z.string().uuid(),
  clinicId: z.string().uuid(),
  patientId: z.string().uuid(),
  admittedByVetId: z.string().uuid(),
  bedIdentifier: z.string(),
  reason: z.string(),
  status: z.enum(HOSPITALIZATION_STATUSES),
  admittedAt: z.string().datetime(),
  dischargedAt: z.string().datetime().nullable(),
  dischargeNotes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const hospitalizationCardSchema = hospitalizationResponseSchema.extend({
  patient: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      species: z.string(),
      photoUrl: z.string().nullable(),
    })
    .optional(),
  admittedByVet: vetSummarySchema.optional(),
})

export const hospitalizationListResponseSchema = z.object({
  items: z.array(hospitalizationCardSchema),
})

export const hospitalizationEvolutionResponseSchema = z.object({
  id: z.string().uuid(),
  hospitalizationId: z.string().uuid(),
  recordedByVetId: z.string().uuid(),
  temperature: z.number().nullable(),
  heartRate: z.number().int().nullable(),
  respiratoryRate: z.number().int().nullable(),
  mucousMembranes: z.string().nullable(),
  notes: z.string(),
  recordedAt: z.string().datetime(),
  recordedByVet: vetSummarySchema.optional(),
})

export const hospitalizationDetailsResponseSchema = hospitalizationCardSchema.extend({
  evolutions: z.array(hospitalizationEvolutionResponseSchema),
})

export function toHospitalizationResponse(hospitalization: Hospitalization) {
  return {
    id: hospitalization.id,
    clinicId: hospitalization.clinicId,
    patientId: hospitalization.patientId,
    admittedByVetId: hospitalization.admittedByVetId,
    bedIdentifier: hospitalization.bedIdentifier,
    reason: hospitalization.reason,
    status: hospitalization.status as (typeof HOSPITALIZATION_STATUSES)[number],
    admittedAt: hospitalization.admittedAt.toISOString(),
    dischargedAt: hospitalization.dischargedAt
      ? hospitalization.dischargedAt.toISOString()
      : null,
    dischargeNotes: hospitalization.dischargeNotes,
    createdAt: hospitalization.createdAt.toISOString(),
    updatedAt: hospitalization.updatedAt.toISOString(),
  }
}

export function toHospitalizationCardResponse(hospitalization: HospitalizationWithPatient) {
  return {
    ...toHospitalizationResponse(hospitalization),
    patient: hospitalization.patient,
    admittedByVet: hospitalization.admittedByVet,
  }
}

export function toHospitalizationEvolutionResponse(evolution: HospitalizationEvolutionWithVet) {
  return {
    id: evolution.id,
    hospitalizationId: evolution.hospitalizationId,
    recordedByVetId: evolution.recordedByVetId,
    temperature: evolution.temperature,
    heartRate: evolution.heartRate,
    respiratoryRate: evolution.respiratoryRate,
    mucousMembranes: evolution.mucousMembranes,
    notes: evolution.notes,
    recordedAt: evolution.recordedAt.toISOString(),
    recordedByVet: evolution.recordedByVet,
  }
}

export function toHospitalizationDetailsResponse(hospitalization: HospitalizationDetails) {
  return {
    ...toHospitalizationCardResponse(hospitalization),
    evolutions: hospitalization.evolutions.map(toHospitalizationEvolutionResponse),
  }
}
