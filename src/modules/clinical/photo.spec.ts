import { describe, it, expect, beforeEach } from 'vitest'
import { InMemoryPatientsRepository } from '../patient/repositories/in-memory/InMemoryPatientsRepository'
import { InMemoryPatientPhotosRepository } from './repositories/in-memory/InMemoryPatientPhotosRepository'
import { UploadPatientPhotoUseCase } from './useCases/photos/uploadPatientPhotoUseCase'
import { ListPatientPhotosUseCase } from './useCases/photos/listPatientPhotosUseCase'
import { AppError } from '../../shared/errors/app-error'

describe('Patient Photo Use Cases', () => {
  let patientsRepository: InMemoryPatientsRepository
  let patientPhotosRepository: InMemoryPatientPhotosRepository
  let uploadUseCase: UploadPatientPhotoUseCase
  let listUseCase: ListPatientPhotosUseCase

  async function createPatient(clinicId = 'clinic-1') {
    return patientsRepository.create({
      name: 'Luna',
      species: 'FELINE',
      sex: 'FEMALE',
      tutorId: 'tutor-xyz',
      clinicId,
    })
  }

  beforeEach(() => {
    patientsRepository = new InMemoryPatientsRepository()
    patientPhotosRepository = new InMemoryPatientPhotosRepository()

    uploadUseCase = new UploadPatientPhotoUseCase(patientPhotosRepository, patientsRepository)
    listUseCase = new ListPatientPhotosUseCase(patientPhotosRepository, patientsRepository)
  })

  describe('upload', () => {
    it('registra uma foto do paciente', async () => {
      const patient = await createPatient()

      const photo = await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/foto.png',
        description: 'Lesão na pata direita',
      })

      expect(photo.id).toEqual(expect.any(String))
      expect(photo.photoUrl).toBe('/uploads/foto.png')
      expect(photo.description).toBe('Lesão na pata direita')
      expect(patientPhotosRepository.items).toHaveLength(1)
    })

    it('usa a data de hoje quando takenAt não é informado', async () => {
      const patient = await createPatient()
      const before = Date.now()

      const photo = await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/foto.png',
      })

      expect(photo.takenAt.getTime()).toBeGreaterThanOrEqual(before)
    })

    it('aceita uma data passada informada pelo veterinário', async () => {
      const patient = await createPatient()
      const takenAt = new Date('2026-01-15T10:00:00.000Z')

      const photo = await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/foto.png',
        takenAt,
      })

      expect(photo.takenAt).toEqual(takenAt)
    })

    it('rejeita data no futuro', async () => {
      const patient = await createPatient()
      const futuro = new Date(Date.now() + 1000 * 60 * 60 * 24)

      await expect(
        uploadUseCase.execute({
          patientId: patient.id,
          clinicId: 'clinic-1',
          photoUrl: '/uploads/foto.png',
          takenAt: futuro,
        })
      ).rejects.toBeInstanceOf(AppError)
    })

    it('não deixa enviar foto para paciente de outra clínica', async () => {
      const patient = await createPatient('clinic-1')

      await expect(
        uploadUseCase.execute({
          patientId: patient.id,
          clinicId: 'clinic-2',
          photoUrl: '/uploads/foto.png',
        })
      ).rejects.toBeInstanceOf(AppError)

      expect(patientPhotosRepository.items).toHaveLength(0)
    })

    it('rejeita paciente inexistente', async () => {
      await expect(
        uploadUseCase.execute({
          patientId: 'nao-existe',
          clinicId: 'clinic-1',
          photoUrl: '/uploads/foto.png',
        })
      ).rejects.toBeInstanceOf(AppError)
    })
  })

  describe('listagem', () => {
    it('devolve as fotos em ordem cronológica crescente', async () => {
      const patient = await createPatient()

      await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/recente.png',
        takenAt: new Date('2026-03-01T10:00:00.000Z'),
      })
      await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/antiga.png',
        takenAt: new Date('2026-01-01T10:00:00.000Z'),
      })

      const photos = await listUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
      })

      expect(photos).toHaveLength(2)
      expect(photos[0].photoUrl).toBe('/uploads/antiga.png')
      expect(photos[1].photoUrl).toBe('/uploads/recente.png')
    })

    it('lista vazia também é válida', async () => {
      const patient = await createPatient()

      const photos = await listUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
      })

      expect(photos).toEqual([])
    })

    it('não deixa listar fotos de paciente de outra clínica', async () => {
      const patient = await createPatient('clinic-1')

      await uploadUseCase.execute({
        patientId: patient.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/foto.png',
      })

      await expect(
        listUseCase.execute({ patientId: patient.id, clinicId: 'clinic-2' })
      ).rejects.toBeInstanceOf(AppError)
    })

    it('não mistura fotos de pacientes diferentes', async () => {
      const luna = await createPatient()
      const outro = await patientsRepository.create({
        name: 'Thor',
        species: 'CANINE',
        sex: 'MALE',
        tutorId: 'tutor-xyz',
        clinicId: 'clinic-1',
      })

      await uploadUseCase.execute({
        patientId: luna.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/luna.png',
      })
      await uploadUseCase.execute({
        patientId: outro.id,
        clinicId: 'clinic-1',
        photoUrl: '/uploads/thor.png',
      })

      const photos = await listUseCase.execute({
        patientId: luna.id,
        clinicId: 'clinic-1',
      })

      expect(photos).toHaveLength(1)
      expect(photos[0].photoUrl).toBe('/uploads/luna.png')
    })
  })
})
