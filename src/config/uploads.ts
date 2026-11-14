import path from 'path'
import { env } from './env'

/**
 * Caminho absoluto da pasta de uploads (exames e fotos de pacientes).
 *
 * Antes este caminho era calculado em dois lugares e de formas diferentes —
 * `__dirname/../uploads` no servidor de arquivos estáticos e
 * `process.cwd()/uploads` no upload de exames. As duas expressões coincidiam
 * rodando a partir da raiz do projeto, mas divergiam em qualquer outro
 * diretório de trabalho, o que deixava o arquivo gravado num lugar e procurado
 * em outro. Agora existe uma única fonte da verdade, configurável por env.
 */
export const UPLOADS_DIR = path.resolve(process.cwd(), env.UPLOADS_DIR)

// SVG fica de fora de propósito: servido inline na origem da API, um SVG com
// <script> executaria como XSS armazenado. Só formatos raster seguros.
const INLINE_IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|gif)$/i

/**
 * Imagens precisam ser renderizadas pelo navegador (galeria de fotos e
 * pré-visualização de exames). Os demais formatos seguem baixando, que é o
 * comportamento esperado para PDF de exame.
 */
export function shouldServeInline(filePath: string): boolean {
  return INLINE_IMAGE_EXTENSIONS.test(filePath)
}
