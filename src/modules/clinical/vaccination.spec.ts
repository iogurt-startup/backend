import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPatientsRepository } from '../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryVaccinationsRepository } from './repositories/in-memory/InMemoryVaccinationsRepository'
import { AddVaccinationUseCase } from './useCases/vaccinations/addVaccinationUseCase'
import { UpdateVaccinationStatusUseCase } from './useCases/vaccinations/updateVaccinationStatusUseCase'
import { ListPatientVaccinationsUseCase } from './useCases/vaccinations/listPatientVaccinationsUseCase'
import { randomUUID } from 'crypto'

describe('Vaccinations Use Cases', () => {
  let patientsRepository: InMemoryPatientsRepository
  let vaccinationsRepository: InMemoryVaccinationsRepository
  let addVaccinationUseCase: AddVaccinationUseCase
  let updateUseCase: UpdateVaccinationStatusUseCase
  let listUseCase: ListPatientVaccinationsUseCase

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    vaccinationsRepository = new InMemoryVaccinationsRepository()

    addVaccinationUseCase = new AddVaccinationUseCase(vaccinationsRepository, patientsRepository)
    updateUseCase = new UpdateVaccinationStatusUseCase(vaccinationsRepository)
    listUseCase = new ListPatientVaccinationsUseCase(vaccinationsRepository)
  })

  it('should add an applied vaccination', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    const vaccination = await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'Raiva',
      status: 'UP_TO_DATE',
      appliedAt: new Date(),
    })

    expect(vaccination.id).toBeDefined()
    expect(vaccination.status).toBe('UP_TO_DATE')
  })

  it('should not allow UP_TO_DATE without appliedAt', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    await expect(addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'Raiva',
      status: 'UP_TO_DATE',
      // omitting appliedAt
    })).rejects.toThrow('Data de aplicação é obrigatória')
  })

  it('should list all patient vaccinations', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'V10',
      status: 'UP_TO_DATE',
      appliedAt: new Date(),
    })

    await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'Gripe',
      status: 'PENDING',
      nextDoseAt: new Date(),
    })

    const items = await listUseCase.execute({ patientId: patient.id })
    expect(items.length).toBe(2)
  })

  it('should not allow updating status of an already UP_TO_DATE vaccination', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    const applied = await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'V10',
      status: 'UP_TO_DATE',
      appliedAt: new Date(),
    })

    await expect(updateUseCase.execute({
      vaccinationId: applied.id,
      clinicId: 'clinic-1',
      status: 'OVERDUE',
    })).rejects.toThrow('Não é possível alterar o status de uma vacina já aplicada')
  })

  it('should calculate nextDoseAt automatically based on appliedAt and intervalDays', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    const appliedAt = new Date('2026-05-10T10:00:00.000Z')
    const intervalDays = 21

    const vaccination = await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'V10',
      status: 'UP_TO_DATE',
      appliedAt,
      doseNumber: 1,
      intervalDays,
    })

    expect(vaccination.doseNumber).toBe(1)
    expect(vaccination.intervalDays).toBe(21)
    expect(vaccination.nextDoseAt).toBeDefined()
    // 2026-05-10 + 21 dias = 2026-05-31
    expect(vaccination.nextDoseAt?.toISOString()).toBe(new Date('2026-05-31T10:00:00.000Z').toISOString())
  })

  it('should handle single-dose vaccine (dose única) without calculating nextDoseAt', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    const appliedAt = new Date('2026-05-10T10:00:00.000Z')

    const vaccination = await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'Raiva Dose Única',
      status: 'UP_TO_DATE',
      appliedAt,
      doseNumber: 1,
      intervalDays: null,
    })

    expect(vaccination.doseNumber).toBe(1)
    expect(vaccination.intervalDays).toBeNull()
    expect(vaccination.nextDoseAt).toBeNull()
  })

  it('should handle last dose of vaccination schedule without calculating nextDoseAt', async () => {
    const patient = await patientsRepository.create({
      name: 'Rex',
      species: 'CANINE',
      sex: 'MALE',
      tutorId: 'tutor-1',
      clinicId: 'clinic-1',
    })

    const appliedAt = new Date('2026-06-01T10:00:00.000Z')

    const vaccination = await addVaccinationUseCase.execute({
      patientId: patient.id,
      clinicId: 'clinic-1',
      vaccineName: 'V10 - 3ª Dose',
      status: 'UP_TO_DATE',
      appliedAt,
      doseNumber: 3,
      // sem intervalo para próxima dose, pois é a última
    })

    expect(vaccination.doseNumber).toBe(3)
    expect(vaccination.nextDoseAt).toBeNull()
  })
})
