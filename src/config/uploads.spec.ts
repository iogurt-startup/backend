import { describe, it, expect } from 'vitest'
import path from 'path'
import { UPLOADS_DIR, shouldServeInline } from './uploads'

describe('Configuração de uploads', () => {
  it('resolve o diretório de uploads para um caminho absoluto', () => {
    expect(path.isAbsolute(UPLOADS_DIR)).toBe(true)
  })

  describe('shouldServeInline', () => {
    it('serve imagens inline, para o navegador conseguir exibir', () => {
      expect(shouldServeInline('/uploads/foto.png')).toBe(true)
      expect(shouldServeInline('/uploads/foto.jpg')).toBe(true)
      expect(shouldServeInline('/uploads/foto.jpeg')).toBe(true)
      expect(shouldServeInline('/uploads/foto.webp')).toBe(true)
      expect(shouldServeInline('/uploads/foto.gif')).toBe(true)
    })

    it('ignora diferença de maiúsculas na extensão', () => {
      expect(shouldServeInline('/uploads/FOTO.JPG')).toBe(true)
      expect(shouldServeInline('/uploads/Foto.PnG')).toBe(true)
    })

    it('mantém PDF como download, que é o esperado para exame', () => {
      expect(shouldServeInline('/uploads/hemograma.pdf')).toBe(false)
    })

    it('não serve inline arquivo sem extensão ou de formato desconhecido', () => {
      expect(shouldServeInline('/uploads/arquivo')).toBe(false)
      expect(shouldServeInline('/uploads/planilha.xlsx')).toBe(false)
    })

    it('nunca serve SVG inline (risco de XSS armazenado)', () => {
      expect(shouldServeInline('/uploads/x.svg')).toBe(false)
      expect(shouldServeInline('/uploads/X.SVG')).toBe(false)
    })

    it('não se confunde com a extensão aparecendo no meio do nome', () => {
      expect(shouldServeInline('/uploads/relatorio.png.pdf')).toBe(false)
    })
  })
})
