import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { TestApp } from '../../utils/app-builder'
import { UPLOADS_DIR } from '@config/uploads'

/**
 * Antes do CLI-05 o servidor de arquivos estáticos devolvia TODO arquivo com
 * `Content-Disposition: attachment`, então o navegador baixava qualquer imagem
 * em vez de exibi-la — o que impedia a galeria de fotos do paciente e a
 * pré-visualização de exames de imagem. Estes testes travam o comportamento
 * correto para que ninguém o reintroduza sem querer.
 */
describe('Servidor de arquivos de upload', () => {
  let app: TestApp

  const imageName = `${randomUUID()}.png`
  const pdfName = `${randomUUID()}.pdf`

  // PNG 1x1 transparente, o menor arquivo válido possível.
  const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  )

  beforeAll(async () => {
    app = await TestApp.build()
    await fs.promises.mkdir(UPLOADS_DIR, { recursive: true })
    await fs.promises.writeFile(path.join(UPLOADS_DIR, imageName), PNG_1X1)
    await fs.promises.writeFile(path.join(UPLOADS_DIR, pdfName), '%PDF-1.4\n%fake\n')
  })

  afterAll(async () => {
    await fs.promises.unlink(path.join(UPLOADS_DIR, imageName)).catch(() => undefined)
    await fs.promises.unlink(path.join(UPLOADS_DIR, pdfName)).catch(() => undefined)
    await app.close()
  })

  it('serve imagem inline, para o navegador exibir', async () => {
    const response = await app.inject({ method: 'GET', url: `/uploads/${imageName}` })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toBeUndefined()
    expect(response.headers['content-type']).toContain('image/png')
  })

  it('mantém PDF como download', async () => {
    const response = await app.inject({ method: 'GET', url: `/uploads/${pdfName}` })

    expect(response.statusCode).toBe(200)
    expect(response.headers['content-disposition']).toBe('attachment')
  })

  it('responde 404 para arquivo inexistente', async () => {
    const response = await app.inject({ method: 'GET', url: '/uploads/nao-existe.png' })

    expect(response.statusCode).toBe(404)
  })
})
