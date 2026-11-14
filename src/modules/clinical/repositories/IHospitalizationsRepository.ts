import type { Hospitalization, HospitalizationEvolution } from '@prisma/client'

export type { Hospitalization, HospitalizationEvolution }

export const HOSPITALIZATION_STATUSES = ['ADMITTED', 'CRITICAL', 'DISCHARGED'] as const
export type HospitalizationStatus = (typeof HOSPITALIZATION_STATUSES)[number]

/**
 * Status que mantêm o leito ocupado. `DISCHARGED` é o único que libera.
 * Usado tanto na regra de admissão única quanto no painel de leitos.
 */
export const OPEN_HOSPITALIZATION_STATUSES = ['ADMITTED', 'CRITICAL'] as const
export type OpenHospitalizationStatus = (typeof OPEN_HOSPITALIZATION_STATUSES)[number]

export interface CreateHospitalizationDTO {
  clinicId: string
  patientId: string
  admittedByVetId: string
  bedIdentifier: string
  reason: string
  /** Só os status de leito ocupado: não se admite paciente já com alta. */
  status?: OpenHospitalizationStatus
}

export interface DischargeHospitalizationDTO {
  dischargedAt: Date
  dischargeNotes?: string | null
}

export interface CreateHospitalizationEvolutionDTO {
  hospitalizationId: string
  recordedByVetId: string
  temperature?: number | null
  heartRate?: number | null
  respiratoryRate?: number | null
  mucousMembranes?: string | null
  notes: string
}

/** Quem admitiu / registrou, para a timeline não mostrar só UUID. */
export interface VetSummary {
  id: string
  name: string
}

export interface HospitalizationEvolutionWithVet extends HospitalizationEvolution {
  recordedByVet?: VetSummary
}

export interface HospitalizationWithPatient extends Hospitalization {
  patient?: {
    id: string
    name: string
    species: string
    photoUrl: string | null
  }
  admittedByVet?: VetSummary
}

export interface HospitalizationDetails extends HospitalizationWithPatient {
  evolutions: HospitalizationEvolutionWithVet[]
}

/**
 * Erro de internação aberta duplicada.
 *
 * O caso de uso checa antes de criar, mas check-then-write não é atômico: dois
 * envios simultâneos passam os dois pela checagem. O índice único parcial no
 * banco é a garantia real, e o repositório Prisma traduz a violação para este
 * erro, para o caso de uso não precisar conhecer códigos do Prisma.
 */
export class OpenHospitalizationConflictError extends Error {
  constructor() {
    super('Este paciente já possui uma internação em aberto.')
    this.name = 'OpenHospitalizationConflictError'
  }
}

export interface IHospitalizationsRepository {
  create(data: CreateHospitalizationDTO): Promise<Hospitalization>
  /** Internação em aberto do paciente, se houver. Base da regra de admissão única. */
  findOpenByPatient(patientId: string): Promise<Hospitalization | null>
  /** Escopado por clínica: é o que impede ler internação de outra clínica. */
  findById(id: string, clinicId: string): Promise<Hospitalization | null>
  findDetailsById(id: string, clinicId: string): Promise<HospitalizationDetails | null>
  listActiveByClinic(clinicId: string): Promise<HospitalizationWithPatient[]>
  /**
   * Só concede alta se a internação ainda estiver em aberto. Devolve `null`
   * quando outra requisição deu a alta primeiro — assim a condição é avaliada
   * pelo banco, não entre duas chamadas.
   */
  discharge(id: string, data: DischargeHospitalizationDTO): Promise<Hospitalization | null>
  /** Troca o status entre ADMITTED e CRITICAL. Null se a internação já teve alta. */
  updateStatus(id: string, status: OpenHospitalizationStatus): Promise<Hospitalization | null>
  /**
   * Só registra evolução se a internação ainda estiver em aberto. `null`
   * quando a alta entrou no meio do caminho.
   */
  addEvolution(
    data: CreateHospitalizationEvolutionDTO
  ): Promise<HospitalizationEvolution | null>
}
