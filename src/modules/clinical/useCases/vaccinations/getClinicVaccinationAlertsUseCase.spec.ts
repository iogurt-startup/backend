import { describe, it, expect, beforeEach } from 'vitest'
import dayjs from 'dayjs'
import { InMemoryVaccinationsRepository } from '../../repositories/in-memory/InMemoryVaccinationsRepository'
import { GetClinicVaccinationAlertsUseCase } from './getClinicVaccinationAlertsUseCase'

describe('GetClinicVaccinationAlertsUseCase', () => {
  let vaccinationsRepository: InMemoryVaccinationsRepository
  let sut: GetClinicVaccinationAlertsUseCase

  const CLINIC_1 = 'clinic-1'
  const CLINIC_2 = 'clinic-2'
  const REFERENCE_DATE = new Date('2026-11-12T10:00:00.000Z')

  beforeEach(() => {
    vaccinationsRepository = new InMemoryVaccinationsRepository()
    sut = new GetClinicVaccinationAlertsUseCase(vaccinationsRepository)

    // Configura dados dos pets e tutores
    vaccinationsRepository.setPatient({
      id: 'patient-1',
      name: 'Thor',
      species: 'CANINE',
      clinicId: CLINIC_1,
      deletedAt: null,
      tutor: {
        id: 'tutor-1',
        fullName: 'Ana Paula',
        phone: '61988887777',
      },
    })

    vaccinationsRepository.setPatient({
      id: 'patient-2',
      name: 'Mel',
      species: 'FELINE',
      clinicId: CLINIC_1,
      deletedAt: null,
      tutor: {
        id: 'tutor-2',
        fullName: 'Bruno Souza',
        phone: '61977776666',
      },
    })

    vaccinationsRepository.setPatient({
      id: 'patient-other-clinic',
      name: 'Outro Pet',
      species: 'CANINE',
      clinicId: CLINIC_2,
      deletedAt: null,
      tutor: {
        id: 'tutor-3',
        fullName: 'Outro Tutor',
        phone: '61911112222',
      },
    })
  })

  it('deve listar vacinas atrasadas (OVERDUE) e a vencer (UPCOMING) da clínica', async () => {
    // 1. Vacina atrasada (passado: 5 dias atrás)
    const overdueDate = dayjs(REFERENCE_DATE).subtract(5, 'day').toDate()
    await vaccinationsRepository.create({
      patientId: 'patient-1',
      vaccineName: 'Raiva',
      appliedAt: dayjs(overdueDate).subtract(365, 'day').toDate(),
      nextDoseAt: overdueDate,
      doseNumber: 1,
      intervalDays: 365,
      status: 'UP_TO_DATE',
    })

    // 2. Vacina próxima a vencer (+10 dias)
    const upcomingDate = dayjs(REFERENCE_DATE).add(10, 'day').toDate()
    await vaccinationsRepository.create({
      patientId: 'patient-2',
      vaccineName: 'V10',
      appliedAt: dayjs(upcomingDate).subtract(21, 'day').toDate(),
      nextDoseAt: upcomingDate,
      doseNumber: 1,
      intervalDays: 21,
      status: 'UP_TO_DATE',
    })

    // 3. Vacina de outra clínica (+5 dias) - não deve vir no resultado
    await vaccinationsRepository.create({
      patientId: 'patient-other-clinic',
      vaccineName: 'Giardia',
      nextDoseAt: dayjs(REFERENCE_DATE).add(5, 'day').toDate(),
      doseNumber: 1,
      status: 'PENDING',
    })

    const response = await sut.execute({
      clinicId: CLINIC_1,
      days: 15,
      referenceDate: REFERENCE_DATE,
    })

    expect(response.total).toBe(2)
    expect(response.items).toHaveLength(2)

    const overdueAlert = response.items.find((i) => i.status === 'OVERDUE')
    expect(overdueAlert).toBeDefined()
    expect(overdueAlert?.vaccineName).toBe('Raiva')
    expect(overdueAlert?.daysOverdue).toBe(5)
    expect(overdueAlert?.patient.name).toBe('Thor')
    expect(overdueAlert?.tutor.fullName).toBe('Ana Paula')

    const upcomingAlert = response.items.find((i) => i.status === 'UPCOMING')
    expect(upcomingAlert).toBeDefined()
    expect(upcomingAlert?.vaccineName).toBe('V10')
    expect(upcomingAlert?.daysUntilDue).toBe(10)
    expect(upcomingAlert?.patient.name).toBe('Mel')
    expect(upcomingAlert?.tutor.fullName).toBe('Bruno Souza')
  })

  it('deve filtrar apenas vacinas OVERDUE quando solicitado', async () => {
    // Vacina atrasada (passado: 12 dias atrás)
    await vaccinationsRepository.create({
      patientId: 'patient-1',
      vaccineName: 'Polivalente',
      nextDoseAt: dayjs(REFERENCE_DATE).subtract(12, 'day').toDate(),
      doseNumber: 2,
      status: 'OVERDUE',
    })

    // Vacina a vencer (hoje + 7 dias)
    await vaccinationsRepository.create({
      patientId: 'patient-2',
      vaccineName: 'Gripe Canina',
      nextDoseAt: dayjs(REFERENCE_DATE).add(7, 'day').toDate(),
      doseNumber: 1,
      status: 'PENDING',
    })

    const response = await sut.execute({
      clinicId: CLINIC_1,
      status: 'OVERDUE',
      referenceDate: REFERENCE_DATE,
    })

    expect(response.total).toBe(1)
    expect(response.items[0].status).toBe('OVERDUE')
    expect(response.items[0].vaccineName).toBe('Polivalente')
    expect(response.items[0].daysOverdue).toBe(12)
  })

  it('deve filtrar apenas vacinas UPCOMING respeitando o limiar de dias informado', async () => {
    // Vacina a vencer em +5 dias (dentro do limiar de 7 dias)
    await vaccinationsRepository.create({
      patientId: 'patient-1',
      vaccineName: 'V8',
      nextDoseAt: dayjs(REFERENCE_DATE).add(5, 'day').toDate(),
      doseNumber: 1,
      status: 'PENDING',
    })

    // Vacina a vencer em +20 dias (fora do limiar de 7 dias)
    await vaccinationsRepository.create({
      patientId: 'patient-2',
      vaccineName: 'Leishmaniose',
      nextDoseAt: dayjs(REFERENCE_DATE).add(20, 'day').toDate(),
      doseNumber: 1,
      status: 'PENDING',
    })

    const response = await sut.execute({
      clinicId: CLINIC_1,
      status: 'UPCOMING',
      days: 7,
      referenceDate: REFERENCE_DATE,
    })

    expect(response.total).toBe(1)
    expect(response.items[0].vaccineName).toBe('V8')
    expect(response.items[0].status).toBe('UPCOMING')
    expect(response.items[0].daysUntilDue).toBe(5)
  })

  it('não deve emitir alerta para dose anterior se a dose subsequente já foi aplicada', async () => {
    // Dose 1 com nextDoseAt vencido há 10 dias
    const dose1NextDose = dayjs(REFERENCE_DATE).subtract(10, 'day').toDate()
    await vaccinationsRepository.create({
      patientId: 'patient-1',
      vaccineName: 'V10',
      doseNumber: 1,
      appliedAt: dayjs(dose1NextDose).subtract(21, 'day').toDate(),
      nextDoseAt: dose1NextDose,
      status: 'UP_TO_DATE',
    })

    // Dose 2 já aplicada há 8 dias, com próxima dose para +300 dias
    await vaccinationsRepository.create({
      patientId: 'patient-1',
      vaccineName: 'V10',
      doseNumber: 2,
      appliedAt: dayjs(REFERENCE_DATE).subtract(8, 'day').toDate(),
      nextDoseAt: dayjs(REFERENCE_DATE).add(300, 'day').toDate(),
      status: 'UP_TO_DATE',
    })

    const response = await sut.execute({
      clinicId: CLINIC_1,
      days: 15,
      referenceDate: REFERENCE_DATE,
    })

    // A Dose 1 não deve alertar OVERDUE porque a Dose 2 já foi aplicada
    // E a Dose 2 está com vencimento para 300 dias (fora dos 15 dias)
    expect(response.total).toBe(0)
  })
})
