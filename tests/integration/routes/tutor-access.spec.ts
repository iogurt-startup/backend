import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { TestApp } from '../../utils/app-builder'
import { HTTP, ROLE, SEED } from '../../utils/constants'

/**
 * Regressão (WEB-03): uma conta TUTOR chegava a listar/editar pacientes e
 * tutores de toda a clínica, porque estas rotas só exigiam autenticação.
 * O tutor deve usar apenas /portal (e a receita do próprio animal).
 */
describe('Rotas da clínica negadas ao perfil TUTOR', () => {
  let app: TestApp

  beforeAll(async () => { app = await TestApp.build() })
  afterAll(async () => { await app.close() })

  const id = SEED.PATIENT_ID
  const cases: Array<{ method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; url: string; payload?: object }> = [
    { method: 'GET', url: '/patients' },
    { method: 'GET', url: `/patients/${id}` },
    { method: 'PUT', url: `/patients/${id}`, payload: { name: 'X' } },
    { method: 'DELETE', url: `/patients/${id}` },
    { method: 'GET', url: '/tutors' },
    { method: 'GET', url: `/tutors/${SEED.TUTOR_ID}` },
    { method: 'GET', url: `/vaccinations/patient/${id}` },
    { method: 'GET', url: `/exams/patient/${id}` },
    { method: 'GET', url: `/patient-photos/patient/${id}` },
    { method: 'GET', url: `/clinical-records/patient/${id}` },
    { method: 'PUT', url: `/clinical-records/${SEED.RECORD_ID}`, payload: { diagnosis: 'x' } },
    { method: 'GET', url: '/dashboard/daily' },
  ]

  it.each(cases)('$method $url retorna 403', async ({ method, url, payload }) => {
    const response = await app.injectAuth(
      { method, url, payload },
      { role: ROLE.TUTOR, userId: SEED.TUTOR_USER_ID },
    )

    expect(response.statusCode).toBe(HTTP.FORBIDDEN)
  })
})
