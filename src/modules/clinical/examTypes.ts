import { z } from 'zod'

export const CLINICAL_EXAM_TYPES = [
  'HEMOGRAMA',
  'BIOQUIMICO',
  'RAIO_X',
  'ULTRASSOM',
  'URINA_FEZES',
  'CITOLOGIA_BIOPSIA',
  'CARDIOLOGICO',
  'OUTRO',
] as const

export type ClinicalExamType = (typeof CLINICAL_EXAM_TYPES)[number]

export const clinicalExamTypeSchema = z.enum(CLINICAL_EXAM_TYPES)
