import { describe, it, expect } from 'vitest'
import { RequestAppointmentUseCase } from '../../src/modules/portal/useCases/requestAppointmentUseCase'
import { ListTutorAppointmentsUseCase } from '../../src/modules/portal/useCases/listTutorAppointmentsUseCase'
import { prismaMock } from '../setup'
import { Factory } from '../utils/factories'
import { SEED, ROLE } from '../utils/constants'
import { AppointmentStatus } from '@prisma/client'

function tutorUserWithPatients(tutorId = SEED.TUTOR_ID, patientId = SEED.PATIENT_ID) {
  return {
    ...Factory.tutorUser(),
    tutorAccount: {
      ...Factory.tutor({ id: tutorId, userId: SEED.TUTOR_USER_ID }),
      patients: [Factory.patient({ id: patientId, tutorId })],
    },
  }
}

describe('Portal Tutor Use Cases', () => {
  describe('RequestAppointmentUseCase', () => {
    it('deve solicitar agendamento com status PENDING_APPROVAL e vetId nulo para pet do tutor', async () => {
      const sut = new RequestAppointmentUseCase()
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000)

      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.patient.findUnique.mockResolvedValue(Factory.patient({ id: SEED.PATIENT_ID, tutorId: SEED.TUTOR_ID }) as never)
      prismaMock.appointment.create.mockResolvedValue({
        id: 'new-app-id',
        patientId: SEED.PATIENT_ID,
        vetId: null,
        dateTime: futureDate,
        endDateTime: null,
        category: 'VACCINATION',
        status: AppointmentStatus.PENDING_APPROVAL,
        observation: 'Primeira dose',
        cancelReason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        patient: {
          id: SEED.PATIENT_ID,
          name: 'Rex',
          species: 'Canino',
        },
      } as never)

      const result = await sut.execute({
        userId: SEED.TUTOR_USER_ID,
        patientId: SEED.PATIENT_ID,
        category: 'VACCINATION',
        dateTime: futureDate,
        observation: 'Primeira dose',
      })

      expect(result.appointment.id).toBe('new-app-id')
      expect(result.appointment.status).toBe('PENDING_APPROVAL')
      expect(result.appointment.vetId).toBeNull()
      expect(prismaMock.appointment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            patientId: SEED.PATIENT_ID,
            vetId: null,
            status: 'PENDING_APPROVAL',
            category: 'VACCINATION',
          }),
        }),
      )
    })

    it('deve rejeitar se o usuário não tiver perfil TUTOR com 403', async () => {
      const sut = new RequestAppointmentUseCase()
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner({ role: ROLE.VET }) as never)

      await expect(sut.execute({
        userId: SEED.VET_ID,
        patientId: SEED.PATIENT_ID,
        category: 'OBSERVATION',
        dateTime: new Date(Date.now() + 86400000),
      })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('deve retornar 404 se a conta de tutor não existir', async () => {
      const sut = new RequestAppointmentUseCase()
      prismaMock.user.findUnique.mockResolvedValue({
        ...Factory.tutorUser(),
        tutorAccount: null,
      } as never)

      await expect(sut.execute({
        userId: SEED.TUTOR_USER_ID,
        patientId: SEED.PATIENT_ID,
        category: 'OBSERVATION',
        dateTime: new Date(Date.now() + 86400000),
      })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('deve retornar 404 se o paciente não for encontrado', async () => {
      const sut = new RequestAppointmentUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.patient.findUnique.mockResolvedValue(null as never)

      await expect(sut.execute({
        userId: SEED.TUTOR_USER_ID,
        patientId: 'inexistent-patient',
        category: 'OBSERVATION',
        dateTime: new Date(Date.now() + 86400000),
      })).rejects.toMatchObject({ statusCode: 404 })
    })

    it('deve rejeitar com 403 se o animal pertencer a outro tutor', async () => {
      const sut = new RequestAppointmentUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients('55555555-5555-5555-5555-555555555555', 'pet-1') as never)
      prismaMock.patient.findUnique.mockResolvedValue(Factory.patient({ id: 'pet-other', tutorId: 'outro-tutor-id' }) as never)

      await expect(sut.execute({
        userId: SEED.TUTOR_USER_ID,
        patientId: 'pet-other',
        category: 'OBSERVATION',
        dateTime: new Date(Date.now() + 86400000),
      })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('deve rejeitar com 400 se a data solicitada for no passado ou agora', async () => {
      const sut = new RequestAppointmentUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.patient.findUnique.mockResolvedValue(Factory.patient({ id: SEED.PATIENT_ID, tutorId: SEED.TUTOR_ID }) as never)

      const pastDate = new Date(Date.now() - 3600000)

      await expect(sut.execute({
        userId: SEED.TUTOR_USER_ID,
        patientId: SEED.PATIENT_ID,
        category: 'OBSERVATION',
        dateTime: pastDate,
      })).rejects.toMatchObject({ statusCode: 400, message: 'A data do agendamento deve ser futura.' })
    })
  })

  describe('ListTutorAppointmentsUseCase', () => {
    it('deve listar agendamentos dos pets do tutor ordenados por data decrescente', async () => {
      const sut = new ListTutorAppointmentsUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.appointment.findMany.mockResolvedValue([
        {
          id: 'app-1',
          patientId: SEED.PATIENT_ID,
          vetId: null,
          dateTime: new Date(),
          category: 'VACCINATION',
          status: 'PENDING_APPROVAL',
          cancelReason: null,
          patient: { id: SEED.PATIENT_ID, name: 'Rex', species: 'Canino' },
        },
      ] as never)

      const result = await sut.execute({ userId: SEED.TUTOR_USER_ID })

      expect(result.appointments).toHaveLength(1)
      expect(result.appointments[0].status).toBe('PENDING_APPROVAL')
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { patientId: { in: [SEED.PATIENT_ID] } },
          orderBy: { dateTime: 'desc' },
        }),
      )
    })

    it('deve incluir apenas id e nome do veterinário, sem dados sensíveis', async () => {
      const sut = new ListTutorAppointmentsUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.appointment.findMany.mockResolvedValue([] as never)

      await sut.execute({ userId: SEED.TUTOR_USER_ID })

      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            vet: { select: { id: true, name: true } },
          }),
        }),
      )
    })

    it('deve devolver o veterinário nos agendados e null nas solicitações pendentes', async () => {
      const sut = new ListTutorAppointmentsUseCase()
      prismaMock.user.findUnique.mockResolvedValue(tutorUserWithPatients() as never)
      prismaMock.appointment.findMany.mockResolvedValue([
        {
          id: 'app-1',
          patientId: SEED.PATIENT_ID,
          vetId: SEED.VET_ID,
          dateTime: new Date(),
          category: 'OBSERVATION',
          status: 'SCHEDULED',
          cancelReason: null,
          patient: { id: SEED.PATIENT_ID, name: 'Rex', species: 'Canino' },
          vet: { id: SEED.VET_ID, name: 'Ana Souza' },
        },
        {
          id: 'app-2',
          patientId: SEED.PATIENT_ID,
          vetId: null,
          dateTime: new Date(),
          category: 'VACCINATION',
          status: 'PENDING_APPROVAL',
          cancelReason: null,
          patient: { id: SEED.PATIENT_ID, name: 'Rex', species: 'Canino' },
          vet: null,
        },
      ] as never)

      const result = await sut.execute({ userId: SEED.TUTOR_USER_ID })

      expect(result.appointments[0].vet).toEqual({ id: SEED.VET_ID, name: 'Ana Souza' })
      expect(result.appointments[1].vet).toBeNull()
    })

    it('deve rejeitar com 403 se o usuário não for TUTOR', async () => {
      const sut = new ListTutorAppointmentsUseCase()
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner({ role: ROLE.VET }) as never)

      await expect(sut.execute({ userId: SEED.VET_ID })).rejects.toMatchObject({ statusCode: 403 })
    })

    it('deve retornar 404 se a conta de tutor não for encontrada', async () => {
      const sut = new ListTutorAppointmentsUseCase()
      prismaMock.user.findUnique.mockResolvedValue({
        ...Factory.tutorUser(),
        tutorAccount: null,
      } as never)

      await expect(sut.execute({ userId: SEED.TUTOR_USER_ID })).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
