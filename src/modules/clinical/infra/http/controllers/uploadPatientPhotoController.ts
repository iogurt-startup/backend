import type { FastifyRequest, FastifyReply } from 'fastify'
import { makeUploadPatientPhotoUseCase } from '../../../useCases/factories/makePatientPhotoUseCases'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { pipeline } from 'stream/promises'
import { AppError } from '@shared/errors/app-error'
import { UPLOADS_DIR } from '@config/uploads'

/** Formatos aceitos e a extensão gravada em disco (nunca a enviada pelo cliente). */
const PHOTO_MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

/** Lê um campo de texto do multipart, que vem embrulhado em `{ value }`. */
function readField(
  fields: Record<string, unknown>,
  name: string
): string | undefined {
  const field = fields[name] as { value?: string } | undefined
  const value = field?.value?.trim()
  return value ? value : undefined
}

export async function uploadPatientPhotoController(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const data = await request.file()

  if (!data) {
    throw new AppError('Nenhum arquivo enviado.', 400)
  }

  const fields = data.fields as Record<string, unknown>
  const patientId = readField(fields, 'patientId')
  const description = readField(fields, 'description')
  const takenAtRaw = readField(fields, 'takenAt')

  if (!patientId) {
    throw new AppError('patientId é obrigatório.', 400)
  }

  // Diferente dos exames, aqui só imagem faz sentido: é uma galeria de
  // acompanhamento visual do paciente.
  // Allowlist (e não `startsWith('image/')`): SVG é image/* e executaria script
  // se aberto direto na origem da API.
  const fileExt = PHOTO_MIME_TO_EXT[data.mimetype]
  if (!fileExt) {
    throw new AppError('Formato inválido. Envie apenas imagem.', 400)
  }

  let takenAt: Date | undefined
  if (takenAtRaw) {
    const parsed = new Date(takenAtRaw)
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError('Data da foto inválida.', 400)
    }
    takenAt = parsed
  }

  const clinicId = request.user.clinicId
  const useCase = makeUploadPatientPhotoUseCase()

  // Valida antes de gravar em disco, para não deixar arquivo órfão quando o
  // paciente não pertence à clínica do usuário.
  await useCase.assertPatientBelongsToClinic(patientId, clinicId)

  const uniqueName = `${randomUUID()}${fileExt}`
  const filePath = path.join(UPLOADS_DIR, uniqueName)
  const photoUrl = `/uploads/${uniqueName}`

  try {
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
    await pipeline(data.file, fs.createWriteStream(filePath))

    const photo = await useCase.execute({
      patientId,
      clinicId,
      photoUrl,
      description,
      takenAt,
    })

    return reply.status(201).send(photo)
  } catch (error) {
    await fs.promises.unlink(filePath).catch(() => undefined)
    throw error
  }
}
