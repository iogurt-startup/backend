import dayjs from 'dayjs'
import { AppError } from '../../../../shared/errors/app-error'
import type { IVaccinationsRepository, CreateVaccinationDTO } from '../../repositories/IVaccinationsRepository'
import type { IPatientsRepository } from '../../../patient/repositories/IPatientsRepository'
import type { Vaccination } from '@prisma/client'

interface AddVaccinationRequest {
  patientId: string
  vaccineName: string
  clinicId: string
  appliedAt?: string | Date
  nextDoseAt?: string | Date
  doseNumber?: number | null
  intervalDays?: number | null
  status: 'UP_TO_DATE' | 'PENDING' | 'OVERDUE'
}

export class AddVaccinationUseCase {
  constructor(
    private vaccinationsRepository: IVaccinationsRepository,
    private patientsRepository: IPatientsRepository
  ) {}

  async execute({
    patientId,
    vaccineName,
    clinicId,
    appliedAt,
    nextDoseAt,
    doseNumber,
    intervalDays,
    status,
  }: AddVaccinationRequest): Promise<Vaccination> {
    const patient = await this.patientsRepository.findById(patientId, clinicId)

    if (!patient) {
      throw new AppError('Paciente não encontrado.', 404)
    }

    if (status === 'UP_TO_DATE' && !appliedAt) {
      throw new AppError('Data de aplicação é obrigatória para vacinas aplicadas.', 400)
    }

    const appliedDate = appliedAt ? new Date(appliedAt) : undefined
    let resolvedNextDoseAt: Date | undefined = nextDoseAt ? new Date(nextDoseAt) : undefined

    // Ao registrar uma aplicação (UP_TO_DATE), calcula automaticamente a próxima dose a partir do intervalo
    if (status === 'UP_TO_DATE') {
      if (appliedDate && typeof intervalDays === 'number' && intervalDays > 0) {
        resolvedNextDoseAt = dayjs(appliedDate).add(intervalDays, 'day').toDate()
      } else if (!nextDoseAt) {
        // Casos de borda: vacina de dose única ou última dose do esquema (sem intervalo para próxima dose)
        resolvedNextDoseAt = undefined
      }
    }

    if (status === 'PENDING' && !resolvedNextDoseAt) {
      throw new AppError('Data da próxima dose é obrigatória para vacinas agendadas.', 400)
    }

    return this.vaccinationsRepository.create({
      patientId,
      vaccineName,
      status,
      appliedAt: appliedDate,
      nextDoseAt: resolvedNextDoseAt,
      doseNumber: doseNumber ?? undefined,
      intervalDays: intervalDays ?? undefined,
    })
  }
}
