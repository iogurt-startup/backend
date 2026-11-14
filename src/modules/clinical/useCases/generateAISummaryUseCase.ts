import { AppError } from '../../../shared/errors/app-error'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '../../../config/prisma'
import { env } from '../../../config/env'
import { clinicalObservationsToPlainText } from '../../../shared/clinical/routine-guidance-meta'

interface GenerateAISummaryRequest {
  recordId: string
  clinicId: string
  vetId?: string
}

interface GenerateAISummaryResponse {
  summary: string
}

export class GenerateAISummaryUseCase {
  async execute({ recordId, clinicId, vetId }: GenerateAISummaryRequest): Promise<GenerateAISummaryResponse> {
    const record = await prisma.clinicalRecord.findFirst({
      where: {
        id: recordId,
        patient: { clinicId },
        ...(vetId ? { vetId } : {}),
      },
      include: { patient: true, vet: true },
    })

    if (!record) {
      throw new AppError('Prontuário não encontrado.', 404)
    }

    if (!record.finalized) {
      throw new AppError('O prontuário precisa ser finalizado antes de gerar o resumo por IA.', 400)
    }

    if (!env.GEMINI_API_KEY) {
      throw new AppError('Chave da API Gemini não configurada.', 500)
    }

    const prompt = `
Você é um assistente clínico de uma clínica veterinária. Analise as informações do atendimento abaixo e gere um mini resumo padronizado para ser consultado pelo veterinário em atendimentos futuros.

Regras obrigatórias:
- Escreva em português brasileiro.
- Use linguagem clínica clara, objetiva e natural.
- Gere exatamente 1 parágrafo, com no máximo 4 frases.
- Comece com "Em DD/MM/AAAA," usando a data da consulta.
- Inclua motivo/queixa ou achados principais, conduta/orientações e pontos de atenção para próximas consultas quando houver.
- Não invente informações ausentes.
- Não use markdown, tópicos, títulos ou listas.
- Não inclua recomendações, faça apenas o resumo do atendimento baseado nos dados

Paciente: ${record.patient.name} (${record.patient.species}${record.patient.breed ? `, ${record.patient.breed}` : ''})
Veterinário: ${record.vet.name}
Data da consulta: ${new Date(record.createdAt).toLocaleDateString('pt-BR')}

Queixa/notas clínicas: ${record.clinicalNotes ?? 'Não informado'}
Exame físico/respiração: ${record.breathingNotes ?? 'Não informado'}
Diagnóstico: ${record.diagnosis ?? 'Não informado'}
Diagnóstico pendente: ${record.pendingDiagnosis ?? 'Nenhum'}
Prescrições: ${record.prescriptions ?? 'Nenhuma'}
Orientações de rotina: ${clinicalObservationsToPlainText(record) || 'Nenhuma'}
${record.weightKg ? `Peso registrado na consulta: ${record.weightKg} kg` : ''}

Gere o resumo agora:
`.trim()

    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
    const modelNames = Array.from(
      new Set([
        env.GEMINI_MODEL,
        ...env.GEMINI_FALLBACK_MODELS.split(',').map(model => model.trim()).filter(Boolean),
      ])
    )

    let summary = ''
    let lastError: unknown = null

    for (const modelName of modelNames) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName })
        const result = await model.generateContent(prompt)
        summary = result.response.text()
        break
      } catch (error) {
        lastError = error
        console.error('Falha ao gerar resumo por IA com modelo Gemini.', {
          recordId,
          model: modelName,
          error,
        })
      }
    }

    if (!summary) {
      throw lastError ?? new AppError('Não foi possível gerar o resumo por IA.', 502)
    }

    // Persiste o resumo no prontuário
    await prisma.clinicalRecord.update({
      where: { id: recordId },
      data: { aiSummary: summary },
    })

    return { summary }
  }
}
