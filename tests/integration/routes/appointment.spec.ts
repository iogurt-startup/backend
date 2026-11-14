import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { APPOINTMENT, HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const FUTURE_ISO = '2026-12-31T10:00:00.000Z'
const FUTURE_END_ISO = '2026-12-31T10:30:00.000Z'

const validBody = (category: typeof APPOINTMENT.CATEGORIES[number]) => ({
  patientId: SEED.PATIENT_ID,
  vetId: SEED.OWNER_ID,
  dateTime: FUTURE_ISO,
  endDateTime: FUTURE_END_ISO,
  category,
})

const REQUESTED_AT = new Date('2099-03-01T09:00:00.000Z')

const pendingAppointment = (overrides: Record<string, unknown> = {}) =>
  Factory.appointment({
    vetId: null,
    dateTime: REQUESTED_AT,
    endDateTime: null,
    category: 'VACCINATION',
    status: 'PENDING_APPROVAL',
    ...overrides,
  })

const withRelations = (appointment: Record<string, unknown>) => ({
  ...appointment,
  patient: { id: SEED.PATIENT_ID, name: 'Rex', species: 'Canino', clinicId: SEED.CLINIC_ID, photoUrl: null },
  vet: appointment.vetId ? { id: appointment.vetId, name: 'Dra. Veterinária' } : null,
})

describe('Appointment routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /appointments', () => {
    it.each(APPOINTMENT.CATEGORIES)(
      'cria agendamento da categoria %s com 201',
      async (category) => {
        prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
        prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
        prismaMock.appointment.create.mockResolvedValue(
          Factory.appointment({ category }) as never,
        )

        const response = await app.injectAuth({
          method: 'POST',
          url: '/appointments',
          payload: validBody(category),
        })

        expect(response.statusCode).toBe(HTTP.CREATED)
        expect(response.json().appointment.category).toBe(category)
      },
    )

    it('retorna 404 quando paciente não existe', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/appointments',
        payload: validBody('OBSERVATION'),
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna 400 quando endDateTime <= dateTime', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/appointments',
        payload: { ...validBody('OBSERVATION'), endDateTime: FUTURE_ISO },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it.each([
      { name: 'patientId inválido', body: { ...validBody('OBSERVATION'), patientId: 'x' } },
      { name: 'categoria desconhecida', body: { ...validBody('OBSERVATION'), category: 'OUTRA' } },
      { name: 'dateTime inválido', body: { ...validBody('OBSERVATION'), dateTime: 'amanha' } },
    ])('rejeita payload inválido ($name) com 422', async ({ body }) => {
      const response = await app.injectAuth({
        method: 'POST',
        url: '/appointments',
        payload: body,
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('permite criação quando perfil é VET', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.create.mockResolvedValue(
        Factory.appointment({ category: 'OBSERVATION' }) as never,
      )

      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/appointments',
          payload: validBody('OBSERVATION'),
        },
        { role: ROLE.VET, userId: SEED.VET_ID },
      )

      expect(response.statusCode).toBe(HTTP.CREATED)
    })

    it('rejeita com 403 quando perfil é TUTOR', async () => {
      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/appointments',
          payload: validBody('OBSERVATION'),
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('GET /appointments', () => {
    it('lista agendamentos do dia', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([Factory.appointment()] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: '/appointments?date=2026-12-31',
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().appointments).toHaveLength(1)
    })

    it('chama findMany com allowlist de status operacionais (SCHEDULED, IN_PROGRESS, COMPLETED)', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: '/appointments?date=2026-12-31',
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED'] },
          }),
        }),
      )
    })

    it('rejeita data em formato inválido', async () => {
      const response = await app.injectAuth({
        method: 'GET',
        url: '/appointments?date=31-12-2026',
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('rejeita com 403 quando perfil é TUTOR', async () => {
      const response = await app.injectAuth(
        {
          method: 'GET',
          url: '/appointments?date=2026-12-31',
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('DELETE /appointments/:id', () => {
    it('cancela agendamento SCHEDULED', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(Factory.appointment() as never)
      prismaMock.appointment.update.mockResolvedValue(
        Factory.appointment({ status: 'CANCELLED', cancelReason: 'tutor pediu' }) as never,
      )

      const response = await app.injectAuth({
        method: 'DELETE',
        url: `/appointments/${SEED.APPOINTMENT_ID}`,
        payload: { reason: 'tutor pediu' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().status).toBe('CANCELLED')
    })

    it.each(['COMPLETED', 'CANCELLED', 'IN_PROGRESS'] as const)(
      'rejeita cancelamento de agendamento com status %s',
      async (status) => {
        prismaMock.appointment.findFirst.mockResolvedValue(
          Factory.appointment({ status }) as never,
        )

        const response = await app.injectAuth({
          method: 'DELETE',
          url: `/appointments/${SEED.APPOINTMENT_ID}`,
          payload: { reason: 'tentativa' },
        })

        expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      },
    )

    it('retorna 404 para agendamento inexistente', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'DELETE',
        url: `/appointments/${SEED.APPOINTMENT_ID}`,
        payload: { reason: 'x' },
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('rejeita com 403 quando perfil é TUTOR', async () => {
      const response = await app.injectAuth(
        {
          method: 'DELETE',
          url: `/appointments/${SEED.APPOINTMENT_ID}`,
          payload: { reason: 'tentativa tutor' },
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('PATCH /appointments/:id/reschedule', () => {
    it('reagenda quando status é SCHEDULED', async () => {
      prismaMock.appointment.findFirst
        .mockResolvedValueOnce(Factory.appointment() as never) // findById
        .mockResolvedValueOnce(null as never)                  // findConflict → sem conflito
      prismaMock.appointment.update.mockResolvedValue(Factory.appointment() as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/appointments/${SEED.APPOINTMENT_ID}/reschedule`,
        payload: { dateTime: FUTURE_ISO, endDateTime: FUTURE_END_ISO },
      })

      expect(response.statusCode).toBe(HTTP.OK)
    })

    it('rejeita com 403 quando perfil é TUTOR', async () => {
      const response = await app.injectAuth(
        {
          method: 'PATCH',
          url: `/appointments/${SEED.APPOINTMENT_ID}/reschedule`,
          payload: { dateTime: FUTURE_ISO, endDateTime: FUTURE_END_ISO },
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('PATCH /appointments/:id', () => {
    it('edita parcialmente um atendimento agendado sem criar outro registro', async () => {
      const existing = Factory.appointment({ category: 'GENERAL', observation: 'Original' })
      const updated = { ...existing, category: 'RETURN', observation: 'Reavaliacao' }
      prismaMock.appointment.findFirst.mockResolvedValue(existing as never)
      prismaMock.appointment.update.mockResolvedValue(updated as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/appointments/${SEED.APPOINTMENT_ID}`,
        payload: { category: 'RETURN', observation: 'Reavaliacao' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().appointment).toMatchObject({ category: 'RETURN', observation: 'Reavaliacao' })
      expect(prismaMock.appointment.create).not.toHaveBeenCalled()
      expect(prismaMock.appointment.update).toHaveBeenCalledWith({
        where: { id: SEED.APPOINTMENT_ID },
        data: { category: 'RETURN', observation: 'Reavaliacao', reminderSentAt: null },
      })
    })

    it.each(['IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const)(
      'rejeita edicao quando status e %s',
      async (status) => {
        prismaMock.appointment.findFirst.mockResolvedValue(Factory.appointment({ status }) as never)
        const response = await app.injectAuth({
          method: 'PATCH',
          url: `/appointments/${SEED.APPOINTMENT_ID}`,
          payload: { category: 'RETURN' },
        })
        expect(response.statusCode).toBe(HTTP.CONFLICT)
      },
    )

    it('rejeita corpo vazio com 422', async () => {
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/appointments/${SEED.APPOINTMENT_ID}`,
        payload: {},
      })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('rejeita tutor com 403', async () => {
      const response = await app.injectAuth(
        { method: 'PATCH', url: `/appointments/${SEED.APPOINTMENT_ID}`, payload: { category: 'RETURN' } },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('GET /appointments?status=', () => {
    it('lista solicitações pendentes da clínica sem exigir date', async () => {
      prismaMock.appointment.findMany.mockResolvedValue([withRelations(pendingAppointment())] as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: '/appointments?status=PENDING_APPROVAL',
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().appointments[0].status).toBe('PENDING_APPROVAL')
      expect(response.json().appointments[0].vet).toBeNull()
      expect(prismaMock.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PENDING_APPROVAL', patient: { clinicId: SEED.CLINIC_ID } },
        }),
      )
    })

    it('rejeita requisição sem date e sem status com 422', async () => {
      const response = await app.injectAuth({ method: 'GET', url: '/appointments' })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('rejeita status desconhecido com 422', async () => {
      const response = await app.injectAuth({ method: 'GET', url: '/appointments?status=WAITING' })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('PATCH /appointments/:id/approve', () => {
    const url = `/appointments/${SEED.APPOINTMENT_ID}/approve`

    it('aprova solicitação, atribui veterinário e calcula endDateTime (200)', async () => {
      prismaMock.appointment.findFirst
        .mockResolvedValueOnce(pendingAppointment() as never) // findById
        .mockResolvedValueOnce(null as never)                 // findConflict → sem conflito
      prismaMock.user.findUnique.mockResolvedValue(Factory.vet() as never)
      prismaMock.appointment.update.mockImplementation((async ({ data }: { data: Record<string, unknown> }) =>
        withRelations(pendingAppointment(data))) as never)

      const response = await app.injectAuth({ method: 'PATCH', url, payload: { vetId: SEED.VET_ID } })

      expect(response.statusCode).toBe(HTTP.OK)
      const { appointment } = response.json()
      expect(appointment.status).toBe('SCHEDULED')
      expect(appointment.vetId).toBe(SEED.VET_ID)
      expect(appointment.vet).toEqual({ id: SEED.VET_ID, name: 'Dra. Veterinária' })
      expect(appointment.endDateTime).toBe('2099-03-01T09:15:00.000Z')
    })

    it('permite aprovação por VET', async () => {
      prismaMock.appointment.findFirst
        .mockResolvedValueOnce(pendingAppointment() as never)
        .mockResolvedValueOnce(null as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.vet() as never)
      prismaMock.appointment.update.mockResolvedValue(withRelations(pendingAppointment({ status: 'SCHEDULED', vetId: SEED.VET_ID })) as never)

      const response = await app.injectAuth(
        { method: 'PATCH', url, payload: { vetId: SEED.VET_ID } },
        { role: ROLE.VET, userId: SEED.VET_ID },
      )

      expect(response.statusCode).toBe(HTTP.OK)
    })

    it('retorna 422 quando vetId não é informado', async () => {
      const response = await app.injectAuth({ method: 'PATCH', url, payload: {} })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
      expect(response.json().issues).toHaveProperty('vetId')
    })

    it('retorna 404 para agendamento de outra clínica', async () => {
      prismaMock.appointment.findFirst.mockResolvedValueOnce(null as never)
      const response = await app.injectAuth({ method: 'PATCH', url, payload: { vetId: SEED.VET_ID } })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna 409 quando o veterinário já tem consulta no horário', async () => {
      prismaMock.appointment.findFirst
        .mockResolvedValueOnce(pendingAppointment() as never)
        .mockResolvedValueOnce(Factory.appointment({ vetId: SEED.VET_ID, dateTime: REQUESTED_AT }) as never)
      prismaMock.user.findUnique.mockResolvedValue(Factory.vet() as never)

      const response = await app.injectAuth({ method: 'PATCH', url, payload: { vetId: SEED.VET_ID } })

      expect(response.statusCode).toBe(HTTP.CONFLICT)
      expect(prismaMock.appointment.update).not.toHaveBeenCalled()
    })

    it('retorna 400 quando a solicitação não está PENDING_APPROVAL', async () => {
      prismaMock.appointment.findFirst.mockResolvedValueOnce(pendingAppointment({ status: 'SCHEDULED', vetId: SEED.VET_ID }) as never)
      const response = await app.injectAuth({ method: 'PATCH', url, payload: { vetId: SEED.VET_ID } })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 403 para TUTOR', async () => {
      const response = await app.injectAuth(
        { method: 'PATCH', url, payload: { vetId: SEED.VET_ID } },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
      expect(prismaMock.appointment.findFirst).not.toHaveBeenCalled()
    })

    it('retorna 401 sem token', async () => {
      const response = await app.inject({ method: 'PATCH', url, payload: { vetId: SEED.VET_ID } })
      expect(response.statusCode).toBe(HTTP.UNAUTHORIZED)
    })
  })

  describe('PATCH /appointments/:id/reject', () => {
    const url = `/appointments/${SEED.APPOINTMENT_ID}/reject`

    it('recusa solicitação e persiste a justificativa (200)', async () => {
      prismaMock.appointment.findFirst.mockResolvedValueOnce(pendingAppointment() as never)
      prismaMock.appointment.update.mockImplementation((async ({ data }: { data: Record<string, unknown> }) =>
        withRelations(pendingAppointment(data))) as never)

      const response = await app.injectAuth({
        method: 'PATCH',
        url,
        payload: { reason: 'Sem disponibilidade de profissionais no horário solicitado.' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      const { appointment } = response.json()
      expect(appointment.status).toBe('REJECTED')
      expect(appointment.cancelReason).toBe('Sem disponibilidade de profissionais no horário solicitado.')
      expect(appointment.vetId).toBeNull()
      expect(appointment.patient.name).toBe('Rex')
    })

    it.each([
      { name: 'sem reason', payload: {} },
      { name: 'reason em branco', payload: { reason: '   ' } },
    ])('retorna 422 $name', async ({ payload }) => {
      const response = await app.injectAuth({ method: 'PATCH', url, payload })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('retorna 404 para agendamento de outra clínica', async () => {
      prismaMock.appointment.findFirst.mockResolvedValueOnce(null as never)
      const response = await app.injectAuth({ method: 'PATCH', url, payload: { reason: 'x' } })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('retorna 400 quando a solicitação não está PENDING_APPROVAL', async () => {
      prismaMock.appointment.findFirst.mockResolvedValueOnce(pendingAppointment({ status: 'REJECTED' }) as never)
      const response = await app.injectAuth({ method: 'PATCH', url, payload: { reason: 'x' } })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('retorna 403 para TUTOR', async () => {
      const response = await app.injectAuth(
        { method: 'PATCH', url, payload: { reason: 'x' } },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })
  })

  describe('Fluxo completo: solicitação do tutor → fila da clínica → aprovação', () => {
    it('tutor solicita, clínica vê a pendência e aprova atribuindo veterinário', async () => {
      // 1. Tutor solicita
      prismaMock.user.findUnique.mockResolvedValueOnce({
        ...Factory.tutorUser(),
        tutorAccount: { ...Factory.tutor({ userId: SEED.TUTOR_USER_ID }), patients: [Factory.patient()] },
      } as never)
      prismaMock.patient.findUnique.mockResolvedValueOnce(Factory.patient() as never)
      prismaMock.appointment.create.mockImplementation((async ({ data }: { data: Record<string, unknown> }) =>
        ({ ...pendingAppointment(data), patient: { id: SEED.PATIENT_ID, name: 'Rex', species: 'Canino' } })) as never)

      const requested = await app.injectAuth(
        {
          method: 'POST',
          url: '/portal/appointments/request',
          payload: { patientId: SEED.PATIENT_ID, category: 'VACCINATION', dateTime: REQUESTED_AT.toISOString() },
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )
      expect(requested.statusCode).toBe(HTTP.CREATED)
      expect(requested.json().appointment).toMatchObject({ status: 'PENDING_APPROVAL', vetId: null })

      // 2. Clínica lista a fila de pendências
      prismaMock.appointment.findMany.mockResolvedValueOnce([withRelations(pendingAppointment())] as never)
      const queue = await app.injectAuth({ method: 'GET', url: '/appointments?status=PENDING_APPROVAL' })
      expect(queue.statusCode).toBe(HTTP.OK)
      const [pending] = queue.json().appointments
      expect(pending.id).toBe(SEED.APPOINTMENT_ID)

      // 3. Clínica aprova atribuindo veterinário
      prismaMock.appointment.findFirst
        .mockResolvedValueOnce(pendingAppointment() as never)
        .mockResolvedValueOnce(null as never)
      prismaMock.user.findUnique.mockResolvedValueOnce(Factory.vet() as never)
      prismaMock.appointment.update.mockImplementation((async ({ data }: { data: Record<string, unknown> }) =>
        withRelations(pendingAppointment(data))) as never)

      const approved = await app.injectAuth({
        method: 'PATCH',
        url: `/appointments/${pending.id}/approve`,
        payload: { vetId: SEED.VET_ID, endDateTime: '2099-03-01T09:30:00.000Z' },
      })
      expect(approved.statusCode).toBe(HTTP.OK)
      expect(approved.json().appointment).toMatchObject({
        status: 'SCHEDULED',
        vetId: SEED.VET_ID,
        endDateTime: '2099-03-01T09:30:00.000Z',
      })
    })
  })
})
