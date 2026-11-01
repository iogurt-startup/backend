import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { Factory } from '../../utils/factories'
import { HTTP, ROLE, SEED, FAKE } from '../../utils/constants'
import { prismaMock } from '../../setup'

describe('Fluxo Completo de Autocadastro de Veterinário e Sigla de Clínica (QA-04)', () => {
  let app: TestApp

  const CLINIC_CODE = 'PETLIFE-8K2'
  const CLINIC_NAME = 'Clínica PetLife Asa Norte'
  const VET_EMAIL = 'dra.beatriz@petlife.com'
  const VET_CRMV = 'CRMV-DF 12345'
  const VET_PASSWORD = 'senhaSegura123'

  beforeAll(async () => {
    app = await TestApp.build()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    prismaMock.clinic.findUnique.mockReset()
    prismaMock.user.findUnique.mockReset()
    prismaMock.user.create.mockReset()
    prismaMock.user.count.mockReset()
  })

  describe('Jornada de Sucesso Ponta a Ponta', () => {
    it('1. Owner cria clínica -> gera sigla -> público valida sigla -> Vet se autocadastra', async () => {
      // 1.1 Registro do Owner criando a clínica e gerando a sigla
      prismaMock.user.findUnique.mockResolvedValueOnce(null)
      prismaMock.clinic.create.mockResolvedValueOnce(
        Factory.clinic({ name: CLINIC_NAME, code: CLINIC_CODE }) as never,
      )
      prismaMock.user.create.mockResolvedValueOnce(Factory.owner() as never)

      const registerOwnerRes = await app.inject({
        method: 'POST',
        url: '/auth/register',
        payload: {
          name: 'Dr. Dono',
          email: 'dono@petlife.com',
          password: 'senhaSegura123',
          clinicName: CLINIC_NAME,
        },
      })

      expect(registerOwnerRes.statusCode).toBe(HTTP.CREATED)
      expect(registerOwnerRes.json().user.clinicCode).toBeDefined()

      // 1.2 Veterinário consulta o código da clínica na interface pública (case-insensitive)
      prismaMock.clinic.findUnique.mockResolvedValueOnce({
        id: SEED.CLINIC_ID,
        name: CLINIC_NAME,
        code: CLINIC_CODE,
        users: [{ id: SEED.OWNER_ID }],
      } as never)

      const validateCodeRes = await app.inject({
        method: 'GET',
        url: `/clinics/code/${CLINIC_CODE.toLowerCase()}`,
      })

      expect(validateCodeRes.statusCode).toBe(HTTP.OK)
      expect(validateCodeRes.json().clinic).toEqual({
        id: SEED.CLINIC_ID,
        name: CLINIC_NAME,
        code: CLINIC_CODE,
      })

      // 1.3 Veterinário realiza o autocadastro vinculando à clínica com CRMV
      prismaMock.user.count.mockResolvedValueOnce(0)
      prismaMock.user.findUnique.mockResolvedValueOnce(null)
      prismaMock.clinic.findUnique.mockResolvedValueOnce({
        id: SEED.CLINIC_ID,
        name: CLINIC_NAME,
        code: CLINIC_CODE,
        users: [{ id: SEED.OWNER_ID }],
      } as never)

      const fakeVetUser = Factory.vet({
        id: SEED.VET_ID,
        name: 'Dra. Beatriz',
        email: VET_EMAIL,
        crmv: VET_CRMV,
        clinicId: SEED.CLINIC_ID,
      })
      prismaMock.user.create.mockResolvedValueOnce(fakeVetUser as never)

      const registerVetRes = await app.inject({
        method: 'POST',
        url: '/auth/register/vet',
        payload: {
          name: 'Dra. Beatriz',
          email: VET_EMAIL,
          password: VET_PASSWORD,
          crmv: VET_CRMV,
          clinicCode: CLINIC_CODE,
        },
      })

      expect(registerVetRes.statusCode).toBe(HTTP.CREATED)
      expect(registerVetRes.json().user).toMatchObject({
        id: SEED.VET_ID,
        email: VET_EMAIL,
        name: 'Dra. Beatriz',
        role: ROLE.VET,
        crmv: VET_CRMV,
        clinicId: SEED.CLINIC_ID,
      })
    })

    it('2. Veterinário autenticado consegue consultar sua clínica e perfil', async () => {
      // Perfil me
      prismaMock.user.findUnique.mockResolvedValueOnce(
        Factory.vet({ crmv: VET_CRMV, clinicId: SEED.CLINIC_ID }) as never,
      )
      const meRes = await app.injectAuth(
        { method: 'GET', url: '/auth/me' },
        { role: ROLE.VET },
      )
      expect(meRes.statusCode).toBe(HTTP.OK)
      expect(meRes.json().user.crmv).toBe(VET_CRMV)

      // Clínica me (deve retornar com código)
      prismaMock.clinic.findUnique.mockResolvedValueOnce(
        Factory.clinic({ code: CLINIC_CODE }) as never,
      )
      const clinicRes = await app.injectAuth(
        { method: 'GET', url: '/clinics/me' },
        { role: ROLE.VET },
      )
      expect(clinicRes.statusCode).toBe(HTTP.OK)
      expect(clinicRes.json().clinic.code).toBe(CLINIC_CODE)
    })
  })

  describe('Blindagem de Regras de Negócio e Permissões (RBAC)', () => {
    it('Veterinário é bloqueado com 403 ao tentar alterar dados da clínica (PATCH /clinics/me)', async () => {
      const response = await app.injectAuth(
        {
          method: 'PATCH',
          url: '/clinics/me',
          payload: { name: 'Tentativa de Mudança por Vet' },
        },
        { role: ROLE.VET },
      )

      expect(response.statusCode).toBe(HTTP.FORBIDDEN)
    })

    it('Rejeita cadastro de veterinário em clínica inexistente com 404', async () => {
      prismaMock.user.count.mockResolvedValueOnce(0)
      prismaMock.clinic.findUnique.mockResolvedValueOnce(null)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register/vet',
        payload: {
          name: 'Dr. Sem Clínica',
          email: 'semclinica@vet.com',
          password: 'senhaSegura123',
          crmv: 'CRMV-DF 99999',
          clinicCode: 'NAOEXISTE-000',
        },
      })

      expect(response.statusCode).toBe(HTTP.NOT_FOUND)
    })

    it('Rejeita cadastro de veterinário em clínica órfã sem OWNER ativo com 400', async () => {
      prismaMock.user.count.mockResolvedValueOnce(0)
      prismaMock.clinic.findUnique.mockResolvedValueOnce({
        id: SEED.CLINIC_ID,
        name: 'Clínica Órfã',
        code: 'ORFA-123',
        users: [], // sem nenhum OWNER
      } as never)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register/vet',
        payload: {
          name: 'Dr. Sem Dono',
          email: 'semdono@vet.com',
          password: 'senhaSegura123',
          crmv: 'CRMV-DF 88888',
          clinicCode: 'ORFA-123',
        },
      })

      expect(response.statusCode).toBe(HTTP.BAD_REQUEST)
      expect(response.json().error).toContain('responsável (Owner) ativo')
    })

    it('Rejeita cadastro de veterinário sem CRMV com 422 de validação Zod', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/register/vet',
        payload: {
          name: 'Dr. Sem CRMV',
          email: 'semcrmv@vet.com',
          password: 'senhaSegura123',
          clinicCode: CLINIC_CODE,
        },
      })

      expect(response.statusCode).toBe(HTTP.UNPROCESSABLE)
    })

    it('Rejeita cadastro de veterinário com e-mail duplicado com 409', async () => {
      prismaMock.user.count.mockResolvedValueOnce(1)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/register/vet',
        payload: {
          name: 'Dr. Duplicado',
          email: 'existente@vet.com',
          password: 'senhaSegura123',
          crmv: 'CRMV-DF 77777',
          clinicCode: CLINIC_CODE,
        },
      })

      expect(response.statusCode).toBe(HTTP.CONFLICT)
      expect(response.json().error).toContain('E-mail já cadastrado')
    })
  })
})
