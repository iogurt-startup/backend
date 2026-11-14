import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, SEED } from '../../utils/constants'
import { prismaMock } from '../../setup'

const VALID_PATIENT_BODY = {
  name: 'Rex',
  tutorId: SEED.TUTOR_ID,
  species: 'CANINE',
  breed: 'SRD',
  sex: 'MALE',
  reproductiveCondition: 'NEUTERED',
  coatDescription: 'Caramelo, pelo curto',
  weightKg: 12.5,
}

describe('Patient routes', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  describe('POST /patients', () => {
    it('cria paciente quando tutor existe', async () => {
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
      prismaMock.patient.create.mockResolvedValue(Factory.patient() as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/patients',
        payload: VALID_PATIENT_BODY,
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(response.json().patient).toMatchObject({ id: SEED.PATIENT_ID })
      expect(prismaMock.patient.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          species: 'CANINE',
          sex: 'MALE',
          reproductiveCondition: 'NEUTERED',
          coatDescription: 'Caramelo, pelo curto',
        }),
      })
    })

    it('permite omitir condicao reprodutiva e descricao de pelagem', async () => {
      const { reproductiveCondition: _reproductiveCondition, coatDescription: _coatDescription, ...requiredBody } = VALID_PATIENT_BODY
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
      prismaMock.patient.create.mockResolvedValue(Factory.patient({
        reproductiveCondition: null,
        coatDescription: null,
      }) as never)

      const response = await app.injectAuth({
        method: 'POST',
        url: '/patients',
        payload: requiredBody,
      })

      expect(response.statusCode).toBe(HTTP.CREATED)
      expect(prismaMock.patient.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          reproductiveCondition: expect.anything(),
          coatDescription: expect.anything(),
        }),
      })
    })

    it.each(['CANINE', 'FELINE', 'BIRD', 'RODENT', 'REPTILE'])(
      'aceita a especie padronizada %s',
      async (species) => {
        prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
        prismaMock.patient.create.mockResolvedValue(Factory.patient({ species }) as never)

        const response = await app.injectAuth({
          method: 'POST',
          url: '/patients',
          payload: { ...VALID_PATIENT_BODY, species },
        })

        expect(response.statusCode).toBe(HTTP.CREATED)
      },
    )

    it.each(['MALE', 'FEMALE', 'UNDETERMINED'])(
      'aceita o sexo padronizado %s',
      async (sex) => {
        prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)
        prismaMock.patient.create.mockResolvedValue(Factory.patient({ sex }) as never)

        const response = await app.injectAuth({
          method: 'POST',
          url: '/patients',
          payload: { ...VALID_PATIENT_BODY, sex },
        })

        expect(response.statusCode).toBe(HTTP.CREATED)
      },
    )

    it('retorna 404 quando tutor não existe', async () => {
      prismaMock.tutor.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'POST',
        url: '/patients',
        payload: VALID_PATIENT_BODY,
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it.each([
      { name: 'sem species', body: { ...VALID_PATIENT_BODY, species: '' } },
      { name: 'sem sex', body: { ...VALID_PATIENT_BODY, sex: undefined } },
      { name: 'species invalida', body: { ...VALID_PATIENT_BODY, species: 'DOG' } },
      { name: 'sex invalido', body: { ...VALID_PATIENT_BODY, sex: 'UNKNOWN' } },
      { name: 'condicao reprodutiva invalida', body: { ...VALID_PATIENT_BODY, reproductiveCondition: 'UNKNOWN' } },
      { name: 'tutorId não UUID', body: { ...VALID_PATIENT_BODY, tutorId: 'bad' } },
      { name: 'peso acima do máximo', body: { ...VALID_PATIENT_BODY, weightKg: 9999 } },
    ])('rejeita payload inválido ($name) com 422', async ({ body }) => {
      const response = await app.injectAuth({ method: 'POST', url: '/patients', payload: body })
      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('GET /patients', () => {
    it('lista pacientes', async () => {
      prismaMock.patient.findMany.mockResolvedValue([Factory.patient()] as never)
      prismaMock.patient.count.mockResolvedValue(1 as never)

      const response = await app.injectAuth({ method: 'GET', url: '/patients' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().patients).toHaveLength(1)
    })

    it('busca pacientes por nome do paciente ou do tutor', async () => {
      prismaMock.patient.findMany.mockResolvedValue([])
      prismaMock.patient.count.mockResolvedValue(0)

      const response = await app.injectAuth({ method: 'GET', url: '/patients?search=Maria' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { name: { contains: 'Maria', mode: 'insensitive' } },
            { tutor: { fullName: { contains: 'Maria', mode: 'insensitive' } } },
          ]),
        }),
      }))
    })

    it('normaliza CPF com mascara antes de pesquisar', async () => {
      prismaMock.patient.findMany.mockResolvedValue([])
      prismaMock.patient.count.mockResolvedValue(0)

      const response = await app.injectAuth({ method: 'GET', url: '/patients?search=529.982.247-25' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.patient.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { tutor: { cpf: { contains: '52998224725' } } },
          ]),
        }),
      }))
    })

    it('retorna lista vazia quando a busca nao encontra pacientes', async () => {
      prismaMock.patient.findMany.mockResolvedValue([])
      prismaMock.patient.count.mockResolvedValue(0)

      const response = await app.injectAuth({ method: 'GET', url: '/patients?search=inexistente' })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json()).toEqual({ patients: [], total: 0 })
    })

    it.each(['a', ' ', 'x'.repeat(101)])('rejeita termo de busca invalido', async (search) => {
      const response = await app.injectAuth({
        method: 'GET',
        url: `/patients?search=${encodeURIComponent(search)}`,
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })
  })

  describe('GET /patients/:id', () => {
    it('retorna 200 quando encontrado', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(Factory.patient() as never)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/patients/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().patient.id).toBe(SEED.PATIENT_ID)
    })

    it('retorna 404 quando não encontrado', async () => {
      prismaMock.patient.findFirst.mockResolvedValue(null)
      const response = await app.injectAuth({
        method: 'GET',
        url: `/patients/${SEED.PATIENT_ID}`,
      })
      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })
  })

  describe('PUT /patients/:id', () => {
    it('atualiza paciente', async () => {
      const patientWithTutor = { ...Factory.patient(), tutor: Factory.tutor() }
      const updatedPatient = { ...Factory.patient({ name: 'Rex Renomeado' }), tutor: Factory.tutor() }
      prismaMock.patient.findFirst
        .mockResolvedValueOnce(patientWithTutor as never)
        .mockResolvedValueOnce(updatedPatient as never)
      prismaMock.patient.update.mockResolvedValue(Factory.patient() as never)
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/patients/${SEED.PATIENT_ID}`,
        payload: { name: 'Rex Renomeado' },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().patient.name).toBe('Rex Renomeado')
    })

    it('atualiza os novos campos do paciente', async () => {
      const patientWithTutor = { ...Factory.patient(), tutor: Factory.tutor() }
      const updatedPatient = {
        ...Factory.patient({
          sex: 'UNDETERMINED',
          reproductiveCondition: 'FERTILE',
          coatDescription: 'Branca, pelo longo',
        }),
        tutor: Factory.tutor(),
      }
      prismaMock.patient.findFirst
        .mockResolvedValueOnce(patientWithTutor as never)
        .mockResolvedValueOnce(updatedPatient as never)
      prismaMock.patient.update.mockResolvedValue(updatedPatient as never)
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/patients/${SEED.PATIENT_ID}`,
        payload: {
          sex: 'UNDETERMINED',
          reproductiveCondition: 'FERTILE',
          coatDescription: 'Branca, pelo longo',
        },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(response.json().patient).toMatchObject({
        sex: 'UNDETERMINED',
        reproductiveCondition: 'FERTILE',
        coatDescription: 'Branca, pelo longo',
      })
    })

    it('permite limpar os campos opcionais do paciente', async () => {
      const patientWithTutor = { ...Factory.patient(), tutor: Factory.tutor() }
      const updatedPatient = {
        ...Factory.patient({ reproductiveCondition: null, coatDescription: null }),
        tutor: Factory.tutor(),
      }
      prismaMock.patient.findFirst
        .mockResolvedValueOnce(patientWithTutor as never)
        .mockResolvedValueOnce(updatedPatient as never)
      prismaMock.patient.update.mockResolvedValue(updatedPatient as never)
      prismaMock.tutor.findFirst.mockResolvedValue(Factory.tutor() as never)

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/patients/${SEED.PATIENT_ID}`,
        payload: { reproductiveCondition: null, coatDescription: null },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.patient.update).toHaveBeenCalledWith({
        where: { id: SEED.PATIENT_ID },
        data: expect.objectContaining({
          reproductiveCondition: null,
          coatDescription: null,
        }),
      })
    })

    it('atualiza os contatos alternativos do tutor pelo paciente', async () => {
      const alternateContacts = [
        { name: 'João Silva', phone: '(61) 99999-1111', relationship: 'Cônjuge', hasWhatsApp: true },
      ]
      const patientWithTutor = { ...Factory.patient(), tutor: Factory.tutor() }
      const updatedTutor = Factory.tutor({
        alternateContacts: [{ ...alternateContacts[0], phone: '61999991111' }],
      })
      const updatedPatient = { ...Factory.patient(), tutor: updatedTutor }
      prismaMock.patient.findFirst
        .mockResolvedValueOnce(patientWithTutor as never)
        .mockResolvedValueOnce(updatedPatient as never)
      prismaMock.tutor.update.mockResolvedValue(updatedTutor as never)
      prismaMock.tutor.findFirst.mockResolvedValue(updatedTutor as never)
      prismaMock.patient.update.mockResolvedValue(Factory.patient() as never)

      const response = await app.injectAuth({
        method: 'PUT',
        url: `/patients/${SEED.PATIENT_ID}`,
        payload: { tutor: { alternateContacts } },
      })

      expect(response.statusCode).toBe(HTTP.OK)
      expect(prismaMock.tutor.update).toHaveBeenCalledWith({
        where: { id: SEED.TUTOR_ID },
        data: {
          alternateContacts: [{ ...alternateContacts[0], phone: '61999991111' }],
        },
      })
    })
  })
})
