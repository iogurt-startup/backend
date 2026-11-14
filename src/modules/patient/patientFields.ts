export const PATIENT_SPECIES = [
  'CANINE',
  'FELINE',
  'BIRD',
  'RODENT',
  'REPTILE',
] as const

export type PatientSpecies = (typeof PATIENT_SPECIES)[number]

export const PATIENT_SEXES = [
  'MALE',
  'FEMALE',
  'UNDETERMINED',
] as const

export type PatientSex = (typeof PATIENT_SEXES)[number]

export const REPRODUCTIVE_CONDITIONS = [
  'FERTILE',
  'NEUTERED',
] as const

export type ReproductiveCondition = (typeof REPRODUCTIVE_CONDITIONS)[number]
