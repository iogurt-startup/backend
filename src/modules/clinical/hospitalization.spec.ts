import { describe, it, expect, beforeEach } from 'vitest'
import { randomUUID } from 'crypto'
import { InMemoryHospitalizationsRepository } from './repositories/in-memory/InMemoryHospitalizationsRepository'
import { InMemoryPatientsRepository } from '../patient/repositories/in-memory/InMemoryPatientsRepository'
import { AddHospitalizationEvolutionUseCase } from './useCases/hospitalizations/addHospitalizationEvolutionUseCase'
import { AdmitPatientUseCase } from './useCases/hospitalizations/admitPatientUseCase'
import { DischargePatientUseCase } from './useCases/hospitalizations/dischargePatientUseCase'
import { GetHospitalizationDetailsUseCase } from './useCases/hospitalizations/getHospitalizationDetailsUseCase'
import { ListActiveHospitalizationsUseCase } from './useCases/hospitalizations/listActiveHospitalizationsUseCase'
import { UpdateHospitalizationStatusUseCase } from './useCases/hospitalizations/updateHospitalizationStatusUseCase'
import { AppError } from '../../shared/errors/app-error'

const CLINIC_ID = 'clinic-1'
const OTHER_CLINIC_ID = 'clinic-2'

describe('Hospitalizations Module (EVO-05)', () => {
  let hospitalizationsRepository: InMemoryHospitalizationsRepository
  let patientsRepository: InMemoryPatientsRepository
  let admitUseCase: AdmitPatientUseCase
  let listActiveUseCase: ListActiveHospitalizationsUseCase
  let detailsUseCase: GetHospitalizationDetailsUseCase
  let addEvolutionUseCase: AddHospitalizationEvolutionUseCase
  let dischargeUseCase: DischargePatientUseCase
  let updateStatusUseCase: UpdateHospitalizationStatusUseCase
  let vetId: string

  async function createPatient(clinicId = CLINIC_ID, name = 'Rex') {
    return patientsRepository.create({
      name,
      species: 'CANINE',
      sex: 'MALE',
      tutorId: randomUUID(),
      clinicId,
    })
  }

  async function admit(patientId: string, overrides: { bedIdentifier?: string } = {}) {
    return admitUseCase.execute({
      clinicId: CLINIC_ID,
      patientId,
      admittedByVetId: vetId,
      bedIdentifier: overrides.bedIdentifier ?? 'Baia 03',
      reason: 'Pós-operatório de castração',
    })
  }

  beforeEach(() => {
    hospitalizationsRepository = new InMemoryHospitalizationsRepository()
    patientsRepository = new InMemoryPatientsRepository()
    vetId = randomUUID()

    admitUseCase = new AdmitPatientUseCase(hospitalizationsRepository, patientsRepository)
    listActiveUseCase = new ListActiveHospitalizationsUseCase(hospitalizationsRepository)
    detailsUseCase = new GetHospitalizationDetailsUseCase(hospitalizationsRepository)
    addEvolutionUseCase = new AddHospitalizationEvolutionUseCase(hospitalizationsRepository)
    dischargeUseCase = new DischargePatientUseCase(hospitalizationsRepository)
    updateStatusUseCase = new UpdateHospitalizationStatusUseCase(hospitalizationsRepository)
  })

  describe('AdmitPatientUseCase', () => {
    it('admite o paciente com status ADMITTED', async () => {
      const patient = await createPatient()

      const hospitalization = await admit(patient.id)

      expect(hospitalization.id).toBeDefined()
      expect(hospitalization.status).toBe('ADMITTED')
      expect(hospitalization.patientId).toBe(patient.id)
      expect(hospitalization.admittedByVetId).toBe(vetId)
      expect(hospitalization.bedIdentifier).toBe('Baia 03')
      expect(hospitalization.dischargedAt).toBeNull()
    })

    it('impede admissão simultânea do mesmo paciente', async () => {
      const patient = await createPatient()
      await admit(patient.id)

      await expect(admit(patient.id)).rejects.toBeInstanceOf(AppError)
      await expect(admit(patient.id)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('impede admissão simultânea também quando a internação está CRITICAL', async () => {
      // CRITICAL continua ocupando leito; só a alta libera o paciente.
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      await updateStatusUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        status: 'CRITICAL',
      })

      await expect(admit(patient.id)).rejects.toMatchObject({ statusCode: 409 })
    })

    it('aceita admitir já como CRITICAL', async () => {
      const patient = await createPatient()

      const hospitalization = await admitUseCase.execute({
        clinicId: CLINIC_ID,
        patientId: patient.id,
        admittedByVetId: vetId,
        bedIdentifier: 'UTI 01',
        reason: 'Choque hipovolêmico',
        status: 'CRITICAL',
      })

      expect(hospitalization.status).toBe('CRITICAL')
    })

    it('traduz conflito do banco em 409 mesmo sem a checagem prévia pegar', async () => {
      // Simula a corrida: o repositório recusa como o índice único parcial do
      // Postgres faria, e o caso de uso precisa devolver 409, não 500.
      const patient = await createPatient()
      await admit(patient.id)

      await expect(
        hospitalizationsRepository.create({
          clinicId: CLINIC_ID,
          patientId: patient.id,
          admittedByVetId: vetId,
          bedIdentifier: 'Baia 9',
          reason: 'segunda tentativa simultânea',
        })
      ).rejects.toThrow('já possui uma internação em aberto')
    })

    it('libera nova admissão depois da alta', async () => {
      const patient = await createPatient()
      const first = await admit(patient.id)
      await dischargeUseCase.execute({ hospitalizationId: first.id, clinicId: CLINIC_ID })

      const second = await admit(patient.id)

      expect(second.id).not.toBe(first.id)
      expect(second.status).toBe('ADMITTED')
    })

    it('recusa paciente de outra clínica', async () => {
      const patient = await createPatient(OTHER_CLINIC_ID)

      await expect(admit(patient.id)).rejects.toMatchObject({ statusCode: 404 })
    })

    it('recusa paciente inexistente', async () => {
      await expect(admit(randomUUID())).rejects.toMatchObject({ statusCode: 404 })
    })

    it('recusa leito em branco', async () => {
      const patient = await createPatient()

      await expect(admit(patient.id, { bedIdentifier: '   ' })).rejects.toMatchObject({
        statusCode: 400,
      })
    })

    it('remove espaços das pontas do leito e do motivo', async () => {
      const patient = await createPatient()

      const hospitalization = await admitUseCase.execute({
        clinicId: CLINIC_ID,
        patientId: patient.id,
        admittedByVetId: vetId,
        bedIdentifier: '  UTI 01  ',
        reason: '  Desidratação severa  ',
      })

      expect(hospitalization.bedIdentifier).toBe('UTI 01')
      expect(hospitalization.reason).toBe('Desidratação severa')
    })
  })

  describe('ListActiveHospitalizationsUseCase', () => {
    it('devolve lista vazia quando não há internados', async () => {
      expect(await listActiveUseCase.execute({ clinicId: CLINIC_ID })).toEqual([])
    })

    it('não devolve internação com alta concedida', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      expect(await listActiveUseCase.execute({ clinicId: CLINIC_ID })).toEqual([])
    })

    it('não enxerga internação de outra clínica', async () => {
      const patient = await createPatient()
      await admit(patient.id)

      expect(await listActiveUseCase.execute({ clinicId: OTHER_CLINIC_ID })).toEqual([])
    })

    it('coloca os pacientes críticos no topo', async () => {
      const estavel = await createPatient(CLINIC_ID, 'Estável')
      const critico = await createPatient(CLINIC_ID, 'Crítico')
      await admit(estavel.id)
      const second = await admit(critico.id)
      // Pelo caso de uso, não forçando o repositório: senão o teste passaria
      // mesmo que não houvesse como marcar o paciente como crítico.
      await updateStatusUseCase.execute({
        hospitalizationId: second.id,
        clinicId: CLINIC_ID,
        status: 'CRITICAL',
      })

      const items = await listActiveUseCase.execute({ clinicId: CLINIC_ID })

      expect(items.map(item => item.patientId)).toEqual([critico.id, estavel.id])
    })

    it('mantém ordem cronológica entre pacientes de mesma criticidade', async () => {
      const primeiro = await createPatient(CLINIC_ID, 'Primeiro')
      const segundo = await createPatient(CLINIC_ID, 'Segundo')
      const a = await admit(primeiro.id)
      await admit(segundo.id)
      // O in-memory grava `admittedAt` com o relógio real, então empurramos a
      // primeira internação para trás para a ordem ficar determinística.
      hospitalizationsRepository.items[0] = {
        ...a,
        admittedAt: new Date('2026-11-01T08:00:00.000Z'),
      }

      const items = await listActiveUseCase.execute({ clinicId: CLINIC_ID })

      expect(items.map(item => item.patientId)).toEqual([primeiro.id, segundo.id])
    })
  })

  describe('GetHospitalizationDetailsUseCase', () => {
    it('devolve a internação com as evoluções em ordem cronológica', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await addEvolutionUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        recordedByVetId: vetId,
        notes: 'Primeira aferição',
      })
      await addEvolutionUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        recordedByVetId: vetId,
        notes: 'Segunda aferição',
      })

      const details = await detailsUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      expect(details.evolutions.map(item => item.notes)).toEqual([
        'Primeira aferição',
        'Segunda aferição',
      ])
    })

    it('recusa internação de outra clínica', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await expect(
        detailsUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: OTHER_CLINIC_ID,
        })
      ).rejects.toMatchObject({ statusCode: 404 })
    })

    it('recusa internação inexistente', async () => {
      await expect(
        detailsUseCase.execute({ hospitalizationId: randomUUID(), clinicId: CLINIC_ID })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('AddHospitalizationEvolutionUseCase', () => {
    it('registra sinais vitais e quem aferiu', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      const evolution = await addEvolutionUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        recordedByVetId: vetId,
        temperature: 38.5,
        heartRate: 90,
        respiratoryRate: 24,
        mucousMembranes: 'Normocoradas',
        notes: 'Aceitou ração, hidratação mantida',
      })

      expect(evolution.temperature).toBe(38.5)
      expect(evolution.heartRate).toBe(90)
      expect(evolution.respiratoryRate).toBe(24)
      expect(evolution.mucousMembranes).toBe('Normocoradas')
      expect(evolution.recordedByVetId).toBe(vetId)
      expect(evolution.recordedAt).toBeInstanceOf(Date)
    })

    it('aceita evolução só com anotação, sem sinais vitais', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      const evolution = await addEvolutionUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        recordedByVetId: vetId,
        notes: 'Medicação administrada',
      })

      expect(evolution.temperature).toBeNull()
      expect(evolution.heartRate).toBeNull()
      expect(evolution.mucousMembranes).toBeNull()
    })

    it('recusa anotação em branco', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await expect(
        addEvolutionUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: CLINIC_ID,
          recordedByVetId: vetId,
          notes: '   ',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('recusa evolução depois da alta', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      await expect(
        addEvolutionUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: CLINIC_ID,
          recordedByVetId: vetId,
          notes: 'Aferição atrasada',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('recusa internação de outra clínica', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await expect(
        addEvolutionUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: OTHER_CLINIC_ID,
          recordedByVetId: vetId,
          notes: 'Aferição indevida',
        })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('UpdateHospitalizationStatusUseCase', () => {
    it('marca como CRITICAL e volta para ADMITTED', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      const critical = await updateStatusUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        status: 'CRITICAL',
      })
      expect(critical.status).toBe('CRITICAL')

      const stable = await updateStatusUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        status: 'ADMITTED',
      })
      expect(stable.status).toBe('ADMITTED')
    })

    it('recusa troca de status depois da alta', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      await expect(
        updateStatusUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: CLINIC_ID,
          status: 'CRITICAL',
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('recusa internação de outra clínica', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await expect(
        updateStatusUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: OTHER_CLINIC_ID,
          status: 'CRITICAL',
        })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })

  describe('DischargePatientUseCase', () => {
    it('concede alta, grava data e orientações', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      const now = new Date('2026-11-13T18:00:00.000Z')

      const discharged = await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
        dischargeNotes: '  Repouso por 7 dias  ',
        now,
      })

      expect(discharged.status).toBe('DISCHARGED')
      expect(discharged.dischargedAt).toEqual(now)
      expect(discharged.dischargeNotes).toBe('Repouso por 7 dias')
    })

    it('aceita alta sem orientações', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      const discharged = await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      expect(discharged.status).toBe('DISCHARGED')
      expect(discharged.dischargeNotes).toBeNull()
    })

    it('recusa alta repetida', async () => {
      // Alta duplicada sobrescreveria a data da alta original.
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)
      await dischargeUseCase.execute({
        hospitalizationId: hospitalization.id,
        clinicId: CLINIC_ID,
      })

      await expect(
        dischargeUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: CLINIC_ID,
        })
      ).rejects.toMatchObject({ statusCode: 400 })
    })

    it('recusa internação de outra clínica', async () => {
      const patient = await createPatient()
      const hospitalization = await admit(patient.id)

      await expect(
        dischargeUseCase.execute({
          hospitalizationId: hospitalization.id,
          clinicId: OTHER_CLINIC_ID,
        })
      ).rejects.toMatchObject({ statusCode: 404 })
    })
  })
})
