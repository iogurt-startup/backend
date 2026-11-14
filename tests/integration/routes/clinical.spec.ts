import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

describe('Clinical record routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /clinical-records', () => {
    it('inicia prontuário a partir de agendamento SCHEDULED', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.findFirst.mockResolvedValue(Factory.appointment() as never)
      prismaMock.clinicalRecord.findUnique.mockResolvedValue(null)
      prismaMock.clinicalRecord.create.mockResolvedValue(Factory.clinicalRecord() as never)
      prismaMock.appointment.update.mockResolvedValue(
        Factory.appointment({ status: 'IN_PROGRESS' }) as never,
      )

      const response = await app.injectAuth({
        method: 'POST',
        url: '/clinical-records',
        payload: { appointmentId: SEED.APPOINTMENT_ID },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().id).toBe(SEED.RECORD_ID)
    })

    it('inicia prontuário como OWNER com CRMV para agendamento de outro veterinário', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        Factory.owner({ id: SEED.OWNER_ID, crmv: 'CRMV-SP 12345' }) as never,
      )
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment({ vetId: SEED.VET_ID }) as never,
      )
      prismaMock.clinicalRecord.findUnique.mockResolvedValue(null)
      prismaMock.clinicalRecord.create.mockResolvedValue(
        Factory.clinicalRecord({ vetId: SEED.OWNER_ID }) as never,
      )
      prismaMock.appointment.update.mockResolvedValue(
        Factory.appointment({ status: 'IN_PROGRESS' }) as never,
      )

      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        },
        { userId: SEED.OWNER_ID, role: ROLE.OWNER }
      )

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().vetId).toBe(SEED.OWNER_ID)
    })

    it('reutiliza prontuário existente do agendamento', async () => {
      prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment({ status: 'IN_PROGRESS' }) as never,
      )
      prismaMock.clinicalRecord.findUnique.mockResolvedValue(Factory.clinicalRecord() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/clinical-records',
        payload: { appointmentId: SEED.APPOINTMENT_ID },
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
    })

    it.each([
      { status: 'COMPLETED', code: HTTP.BAD_REQUEST },
      { status: 'CANCELLED', code: HTTP.BAD_REQUEST },
      { status: 'PENDING_APPROVAL', code: HTTP.BAD_REQUEST },
      { status: 'REJECTED', code: HTTP.BAD_REQUEST },
    ] as const)(
      'rejeita quando agendamento está $status',
      async ({ status, code }) => {
        prismaMock.user.findUnique.mockResolvedValue(Factory.owner() as never)
        prismaMock.appointment.findFirst.mockResolvedValue(
          Factory.appointment({ status }) as never,
        )

        const response = await app.injectAuth({
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        })

        expect(response.statusCode).toBe(code)
      },
    )

    it('rejeita com 403 quando OWNER não possui CRMV cadastrado', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        Factory.owner({ id: SEED.OWNER_ID, crmv: null }) as never,
      )
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment({ vetId: SEED.VET_ID }) as never,
      )

      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        },
        { userId: SEED.OWNER_ID, role: ROLE.OWNER }
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 403 quando vet do token não é o responsável', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        Factory.vet({ id: 'other-vet-id' }) as never,
      )
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment({ vetId: SEED.VET_ID }) as never,
      )
      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        },
        { userId: 'other-vet-id', role: ROLE.VET }
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 403 quando TUTOR tenta iniciar prontuário', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        Factory.tutorUser({ id: SEED.TUTOR_USER_ID }) as never,
      )
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment() as never,
      )
      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        },
        { userId: SEED.TUTOR_USER_ID, role: ROLE.TUTOR }
      )
      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 403 quando VET originalmente agendado tenta iniciar após OWNER já ter iniciado', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        Factory.vet({ id: SEED.VET_ID }) as never,
      )
      prismaMock.appointment.findFirst.mockResolvedValue(
        Factory.appointment({ vetId: SEED.VET_ID }) as never,
      )
      prismaMock.clinicalRecord.findUnique.mockResolvedValue(
        Factory.clinicalRecord({ vetId: SEED.OWNER_ID }) as never,
      )

      const response = await app.injectAuth(
        {
          method: 'POST',
          url: '/clinical-records',
          payload: { appointmentId: SEED.APPOINTMENT_ID },
        },
        { userId: SEED.VET_ID, role: ROLE.VET }
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('retorna 404 quando agendamento não existe', async () => {
      prismaMock.appointment.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'POST',
        url: '/clinical-records',
        payload: { appointmentId: SEED.APPOINTMENT_ID },
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('PUT /clinical-records/:id', () => {
    it('atualiza dados do prontuário', async () => {
      prismaMock.clinicalRecord.findFirst.mockResolvedValue(Factory.clinicalRecord() as never)
      prismaMock.clinicalRecord.update.mockResolvedValue(
        Factory.clinicalRecord({ diagnosis: 'Otite' }) as never,
      )

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/clinical-records/${SEED.RECORD_ID}`,
        payload: { diagnosis: 'Otite', weightKg: 13 },
      })

      expect(response.statusCode).toBe(HTTP.OK)
    })

    // CLI-01 — o schema precisa aceitar o campo novo, senão o Zod derruba a
    // requisição com 400 e a observação nunca chega no banco.
    it('aceita observações do atendimento no corpo da requisição', async () => {
      prismaMock.clinicalRecord.findFirst.mockResolvedValue(Factory.clinicalRecord() as never)
      prismaMock.clinicalRecord.update.mockResolvedValue(
        Factory.clinicalRecord({ observations: 'Tosse noturna' }) as never,
      )

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/clinical-records/${SEED.RECORD_ID}`,
        payload: { observations: 'Tosse noturna' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().observations).toBe('Tosse noturna')
      expect(prismaMock.clinicalRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ observations: 'Tosse noturna' }) }),
      )
    })

    it('retorna 404 quando prontuário não existe', async () => {
      prismaMock.clinicalRecord.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'PUT',
        url: `/clinical-records/${SEED.RECORD_ID}`,
        payload: { diagnosis: 'Otite' },
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('PATCH /clinical-records/:id/finalize', () => {
    it('finaliza prontuário e marca agendamento como COMPLETED', async () => {
      prismaMock.clinicalRecord.findFirst.mockResolvedValue(Factory.clinicalRecord() as never)
      prismaMock.clinicalRecord.update.mockResolvedValue(
        Factory.clinicalRecord({ finalized: true }) as never,
      )
      prismaMock.appointment.update.mockResolvedValue(
        Factory.appointment({ status: 'COMPLETED' }) as never,
      )

      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/clinical-records/${SEED.RECORD_ID}/finalize`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().finalized).toBe(true)
    })

    it('rejeita finalização duplicada com 400', async () => {
      prismaMock.clinicalRecord.findFirst.mockResolvedValue(
        Factory.clinicalRecord({ finalized: true }) as never,
      )
      const response = await app.injectAuth({
        method: 'PATCH',
        url: `/clinical-records/${SEED.RECORD_ID}/finalize`,
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })
  })

  describe('GET /clinical-records/patient/:patientId', () => {
    it('lista histórico do paciente', async () => {
      prismaMock.clinicalRecord.findMany.mockResolvedValue([Factory.clinicalRecord()] as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/clinical-records/patient/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().items).toHaveLength(1)
    })
  })

  describe('GET /clinical-records/:id/prescription', () => {
    it('rejeita quando prontuário não está finalizado', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({ finalized: false }),
        patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
        vet: Factory.owner(),
      } as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('rejeita quando prontuário não tem prescrição', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({ finalized: true, prescriptions: null }),
        patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
        vet: Factory.owner(),
      } as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
      })
      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
    })

    it('gera PDF quando prontuário está finalizado e possui prescrições', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          prescriptions: 'Amoxicilina 250mg, 2x ao dia, 7 dias.',
          routineGuidance: null,
        }),
        patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
        vet: Factory.owner(),
      } as never)

      const response = await app.injectAuth({
        method: 'GET',
        url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.headers['content-type']).toContain('application/pdf')
    })

    it('permite emissão quando perfil é VET autor do prontuário', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          vetId: SEED.VET_ID,
          prescriptions: 'Amoxicilina 250mg',
        }),
        patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
        vet: Factory.vet(),
      } as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
        },
        { role: ROLE.VET, userId: SEED.VET_ID },
      )

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.headers['content-type']).toContain('application/pdf')
    })

    it('rejeita com 403 quando perfil é VET mas não é o autor', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          vetId: SEED.VET_ID,
          prescriptions: 'Amoxicilina 250mg',
        }),
        patient: { ...Factory.patient(), tutor: Factory.tutor(), clinic: Factory.clinic() },
        vet: Factory.vet(),
      } as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
        },
        { role: ROLE.VET, userId: 'outro-vet-id' },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('permite emissão quando perfil é TUTOR dono do paciente', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          prescriptions: 'Amoxicilina 250mg',
        }),
        patient: {
          ...Factory.patient(),
          tutor: Factory.tutor({ userId: SEED.TUTOR_USER_ID }),
          clinic: Factory.clinic(),
        },
        vet: Factory.owner(),
      } as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
        },
        { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
      )

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.headers['content-type']).toContain('application/pdf')
    })

    it('rejeita com 403 quando perfil é TUTOR mas não é dono do paciente', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          prescriptions: 'Amoxicilina 250mg',
        }),
        patient: {
          ...Factory.patient(),
          tutor: Factory.tutor({ userId: SEED.TUTOR_USER_ID }),
          clinic: Factory.clinic(),
        },
        vet: Factory.owner(),
      } as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
        },
        { role: ROLE.TUTOR, userId: 'outro-tutor-user-id' },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('rejeita com 404 quando prontuário pertence a outra clínica', async () => {
      prismaMock.clinicalRecord.findUnique.mockResolvedValue({
        ...Factory.clinicalRecord({
          finalized: true,
          prescriptions: 'Amoxicilina 250mg',
        }),
        patient: {
          ...Factory.patient({ clinicId: 'outra-clinica-id' }),
          tutor: Factory.tutor({ userId: SEED.TUTOR_USER_ID }),
          clinic: Factory.clinic({ id: 'outra-clinica-id' }),
        },
        vet: Factory.owner(),
      } as never)

      const response = await app.injectAuth(
        {
          method: 'GET',
          url: `/clinical-records/${SEED.RECORD_ID}/prescription`,
        },
        { clinicId: SEED.CLINIC_ID },
      )

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })
})
