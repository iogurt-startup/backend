import PDFDocument from 'pdfkit'
import { AppError } from '../../../shared/errors/app-error'
import { prisma } from '../../../config/prisma'
import { clinicalObservationsToPlainText } from '../../../shared/clinical/routine-guidance-meta'

import type { Role } from '@prisma/client'

interface GeneratePrescriptionRequest {
  recordId: string
  userId: string
  role: Role
  clinicId: string
}

// ── Design tokens alinhados ao site (frontend/src/styles/index.css) ──
const BRAND = {
  primary: '#F5A9C8', // --pink-300
  primaryDark: '#EC6FA5', // --pink-500 (mais saturado, usado nas faixas)
  textDark: '#111827', // --gray-900
  textMuted: '#6B7280', // --gray-500
  divider: '#F5A9C8',
}

const PAGE_WIDTH = 595.28
const MARGIN_X = 50

/** Faixas rosa mais grossas/saturadas, visíveis no topo e na base da folha. */
const TOP_BRAND_BAR_H = 18
const BOTTOM_BRAND_BAR_H = 18

/** Área do rodapé (linha + patinha + textos) fica imediatamente acima da faixa inferior. */
const FOOTER_CONTENT_GAP = 6

/**
 * Desenha uma pequena patinha estilizada (mesmo motif do PawSvg do frontend),
 * usando apenas primitivas do pdfkit para não depender de arquivos externos.
 */
function drawPawIcon(doc: PDFKit.PDFDocument, x: number, y: number, size = 14) {
  const scale = size / 20
  doc.save()
  doc.fillColor(BRAND.primary)

  // Pad central (elipse arredondada)
  doc.ellipse(x + 10 * scale, y + 9 * scale, 8 * scale, 7 * scale).fill()

  // Dedinhos (três círculos pequenos acima do pad)
  doc.circle(x + 3 * scale, y + 2 * scale, 2.2 * scale).fill()
  doc.circle(x + 10 * scale, y, 2.4 * scale).fill()
  doc.circle(x + 17 * scale, y + 2 * scale, 2.2 * scale).fill()

  doc.restore()
}

/** Faixa rosa no topo da página (mais grossa e saturada que a versão anterior). */
function drawTopBrandBar(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width
  doc.save()
  doc.rect(0, 0, pageWidth, TOP_BRAND_BAR_H)
  doc.fillColor(BRAND.primaryDark).fill()
  doc.restore()
}

/** Faixa rosa no rodapé físico da folha (espelha o topo). */
function drawBottomBrandBar(doc: PDFKit.PDFDocument) {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  doc.save()
  const y = pageHeight - BOTTOM_BRAND_BAR_H
  doc.rect(0, y, pageWidth, BOTTOM_BRAND_BAR_H)
  doc.fillColor(BRAND.primaryDark).fill()
  doc.restore()
}

/**
 * Rodapé: linha rosa, patinha + marca à esquerda, timestamp centralizado.
 * Desenhado acima da faixa rosa inferior.
 */
function drawFooter(doc: PDFKit.PDFDocument, emittedAt: Date): number {
  const pageWidth = doc.page.width
  const pageHeight = doc.page.height
  const footerContentBottom = pageHeight - BOTTOM_BRAND_BAR_H - FOOTER_CONTENT_GAP
  doc.save()

  const lineY = footerContentBottom - 26

  doc
    .moveTo(MARGIN_X, lineY)
    .lineTo(pageWidth - MARGIN_X, lineY)
    .lineWidth(1.2)
    .strokeColor(BRAND.divider)
    .stroke()

  const iconY = footerContentBottom - 22
  drawPawIcon(doc, MARGIN_X, iconY, 14)
  doc
    .fillColor(BRAND.primaryDark)
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('iougurt', MARGIN_X + 24, iconY + 1, { lineBreak: false })

  const timestamp = emittedAt.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  })
  doc
    .fillColor(BRAND.textMuted)
    .font('Helvetica')
    .fontSize(8)
    .text(
      `Receituário emitido em ${timestamp}`,
      MARGIN_X,
      iconY + 2,
      { width: pageWidth - MARGIN_X * 2, align: 'center', lineBreak: false },
    )

  doc.restore()
  return footerContentBottom
}

export class GeneratePrescriptionUseCase {
  async execute({ recordId, userId, role, clinicId }: GeneratePrescriptionRequest): Promise<Buffer> {
    const record = await prisma.clinicalRecord.findUnique({
      where: { id: recordId },
      include: {
        patient: {
          include: {
            tutor: true,
            clinic: true,
          },
        },
        vet: true,
      },
    })

    if (!record || record.patient.clinicId !== clinicId) {
      throw new AppError('Prontuário não encontrado.', 404)
    }

    if (role === 'VET' && record.vetId !== userId) {
      throw new AppError('Apenas o veterinário responsável ou o proprietário pode emitir a receita.', 403)
    }

    if (role === 'TUTOR') {
      if (!record.patient.tutor?.userId || record.patient.tutor.userId !== userId) {
        throw new AppError('Você não tem permissão para acessar a receita deste animal.', 403)
      }
    }

    if (role !== 'OWNER' && role !== 'VET' && role !== 'TUTOR') {
      throw new AppError('Acesso não autorizado para este perfil.', 403)
    }

    if (!record.finalized) {
      throw new AppError('O prontuário precisa ser finalizado antes de emitir a receita.', 400)
    }

    if (!record.prescriptions) {
      throw new AppError('Este prontuário não possui prescrições registradas.', 400)
    }

    const clinic = record.patient.clinic
    const emittedAt = new Date()

    return new Promise<Buffer>((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: 'A4',
        bufferPages: true, // permite pintar chrome em todas as páginas ao final
      })
      const chunks: Buffer[] = []

      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // ── Cabeçalho da clínica ───────────────────────────
      doc.moveDown(0.5)
      doc
        .fillColor(BRAND.primaryDark)
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(clinic.name.toUpperCase(), { align: 'center' })
      doc.moveDown(0.2)

      doc.fillColor(BRAND.textMuted).fontSize(9).font('Helvetica')
      const headerLines: string[] = ['Clínica Veterinária']
      if (clinic.cnpj) headerLines.push(`CNPJ: ${clinic.cnpj}`)
      if (clinic.address) headerLines.push(clinic.address)
      if (clinic.phone) headerLines.push(`Tel: ${clinic.phone}`)
      headerLines.forEach((line) => doc.text(line, { align: 'center' }))

      doc.moveDown(0.6)
      doc
        .moveTo(MARGIN_X, doc.y)
        .lineTo(PAGE_WIDTH - MARGIN_X, doc.y)
        .lineWidth(1)
        .strokeColor(BRAND.divider)
        .stroke()
      doc.moveDown(0.5)

      // ── Título ──────────────────────────────────────────
      doc
        .fillColor(BRAND.textDark)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('RECEITUÁRIO VETERINÁRIO')
      doc.moveDown(0.5)

      // ── Dados do Paciente ───────────────────────────────
      doc.font('Helvetica').fontSize(10).fillColor(BRAND.textDark)
      doc.text(`Paciente: ${record.patient.name}`)
      doc.text(`Espécie: ${record.patient.species}`)
      if (record.patient.breed) doc.text(`Raça: ${record.patient.breed}`)
      if (record.patient.tutor?.fullName) doc.text(`Tutor(a): ${record.patient.tutor.fullName}`)
      doc.text(`Data: ${new Date(record.createdAt).toLocaleDateString('pt-BR')}`)
      doc.moveDown(0.5)

      doc
        .moveTo(MARGIN_X, doc.y)
        .lineTo(PAGE_WIDTH - MARGIN_X, doc.y)
        .lineWidth(0.6)
        .strokeColor(BRAND.divider)
        .stroke()
      doc.moveDown(0.5)

      // ── Prescrições ─────────────────────────────────────
      doc
        .font('Helvetica-Bold')
        .fontSize(11)
        .fillColor(BRAND.primaryDark)
        .text('Prescrições:')
      doc.moveDown(0.3)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(BRAND.textDark)
        .text(record.prescriptions ?? '', {
          width: PAGE_WIDTH - MARGIN_X * 2,
          align: 'left',
        })
      doc.moveDown(1)

      // ── Orientações (texto legível — sem JSON __IOUGURT_META__) ──
      // Lê do campo próprio (CLI-01) e do formato legado, nessa ordem.
      const guidancePlain = clinicalObservationsToPlainText(record)
      if (guidancePlain) {
        doc
          .font('Helvetica-Bold')
          .fontSize(11)
          .fillColor(BRAND.primaryDark)
          .text('Orientações ao Tutor:')
        doc.moveDown(0.3)
        doc
          .font('Helvetica')
          .fontSize(10)
          .fillColor(BRAND.textDark)
          .text(guidancePlain, {
            width: PAGE_WIDTH - MARGIN_X * 2,
            align: 'left',
          })
        doc.moveDown(1)
      }

      // ── Assinatura ──────────────────────────────────────
      doc.moveDown(2)
      doc
        .moveTo(200, doc.y)
        .lineTo(400, doc.y)
        .lineWidth(0.8)
        .strokeColor(BRAND.textMuted)
        .stroke()
      doc.moveDown(0.3)
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(BRAND.textDark)
        .text(`Dr(a). ${record.vet.name}`, { align: 'center' })
      doc.text('Médico(a) Veterinário(a)', { align: 'center' })
      if (record.vet.crmv) {
        doc.text(`CRMV: ${record.vet.crmv}`, { align: 'center' })
      }

      // ── Faixas rosa (topo + base) + rodapé em TODAS as páginas ──
      // Não usar o evento `pageAdded`: ao desenhar no rodapé o pdfkit pode
      // disparar `continueOnNewPage` → `addPage` → recursão infinita.
      const range = doc.bufferedPageRange()
      for (let i = 0; i < range.count; i += 1) {
        doc.switchToPage(range.start + i)
        drawTopBrandBar(doc)
        const footerContentBottom = drawFooter(doc, emittedAt)
        drawBottomBrandBar(doc)
        if (range.count > 1) {
          doc
            .fillColor(BRAND.textMuted)
            .font('Helvetica')
            .fontSize(8)
            .text(
              `Página ${i + 1} de ${range.count}`,
              MARGIN_X,
              footerContentBottom - 20,
              {
                width: PAGE_WIDTH - MARGIN_X * 2,
                align: 'right',
                lineBreak: false,
              },
            )
        }
      }

      doc.end()
    })
  }
}
