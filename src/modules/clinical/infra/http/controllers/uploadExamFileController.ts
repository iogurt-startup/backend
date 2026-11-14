import type { FastifyRequest, FastifyReply } from 'fastify'
import { makeUploadExamFileUseCase } from '../../../useCases/factories/makeExamFilesUseCases'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { AppError } from '@shared/errors/app-error'
import { UPLOADS_DIR } from '@config/uploads'
import { clinicalExamTypeSchema } from '../../../examTypes'

const PDF_MIME = 'application/pdf'

export async function uploadExamFileController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const data = await request.file()

  if (!data) {
    throw new AppError('Nenhum arquivo enviado.', 400)
  }

  const patientIdField = data.fields.patientId as unknown as { value: string } | undefined
  const patientId = patientIdField?.value

  const clinicalRecordIdField = data.fields.clinicalRecordId as unknown as { value: string } | undefined
  const clinicalRecordId = clinicalRecordIdField?.value

  const clinicalTypeField = data.fields.clinicalType as unknown as { value: string } | undefined
  const rawClinicalType = clinicalTypeField?.value?.trim()

  let clinicalType: string | null = null
  if (rawClinicalType) {
    const parsed = clinicalExamTypeSchema.safeParse(rawClinicalType.toUpperCase())
    if (!parsed.success) {
      throw new AppError('Tipo clínico de exame inválido.', 400)
    }
    clinicalType = parsed.data
  }

  if (!patientId) {
    throw new AppError('patientId é obrigatório.', 400)
  }

  const clinicId = request.user.clinicId
  const useCase = makeUploadExamFileUseCase()
  await useCase.assertPatientBelongsToClinic(patientId, clinicId)

  let fileType: 'image' | 'pdf'
  if (data.mimetype === PDF_MIME) {
    fileType = 'pdf'
  } else if (data.mimetype.startsWith('image/')) {
    fileType = 'image'
  } else {
    throw new AppError('Formato inválido. Envie apenas PDF ou imagem.', 400)
  }

  const fileExt = path.extname(data.filename)
  const uniqueName = `${randomUUID()}${fileExt}`
  const filePath = path.join(UPLOADS_DIR, uniqueName)
  const fileUrl = `/uploads/${uniqueName}`

  try {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
    await pipeline(data.file, fs.createWriteStream(filePath))

    const examFile = await useCase.execute({
      patientId,
      clinicId,
      clinicalRecordId,
      fileName: data.filename,
      fileUrl,
      fileType,
      clinicalType,
    })
    return reply.status(201).send(examFile)
  } catch (error) {
    await fs.promises.unlink(filePath).catch(() => undefined)
    throw error
  }
}
