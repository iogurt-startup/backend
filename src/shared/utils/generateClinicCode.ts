import crypto from 'crypto'

// 5 caracteres em alfabeto de 32 símbolos → ~33,5 milhões de combinações por prefixo,
// o que inviabiliza descobrir a sigla por tentativa e erro na rota pública.
const SUFFIX_LENGTH = 5

/**
 * Gera uma sigla amigável e única para a clínica baseada em seu nome.
 * Formato gerado: [PREFIXO]-[SUFIXO], ex: "PETLIFE-7A2K9", "SAOJOSE-8K3WM".
 *
 * @param clinicName Nome da clínica
 * @returns Sigla normalizada em caixa alta com sufixo aleatório
 */
export function generateClinicCode(clinicName: string): string {
  if (!clinicName || typeof clinicName !== 'string') {
    return `CLINIC-${generateRandomSuffix(SUFFIX_LENGTH)}`
  }

  // 1. Remove acentos e converte para maiúsculo
  const normalized = clinicName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

  // 2. Stop words comuns a serem desconsideradas na geração da sigla
  const stopWords = new Set([
    'DE', 'DA', 'DO', 'DAS', 'DOS', 'E', 'EM', 'PARA', 'COM',
    'CLINICA', 'VETERINARIA', 'VET', 'CENTRO', 'HOSPITAL',
  ])

  // 3. Extrai apenas tokens alfanuméricos
  const tokens = normalized
    .replace(/[^A-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const significantTokens = tokens.filter((t) => !stopWords.has(t))

  let candidate = ''
  if (significantTokens.length > 0) {
    candidate = significantTokens.join('')
  } else if (tokens.length > 0) {
    candidate = tokens.join('')
  } else {
    candidate = 'CLINIC'
  }

  // Garante que o prefixo tenha entre 3 e 8 caracteres alfanuméricos
  const cleanPrefix = candidate.replace(/[^A-Z0-9]/g, '')
  let prefix = cleanPrefix.slice(0, 8)
  if (prefix.length < 3) {
    prefix = prefix.padEnd(3, 'X')
  }

  const suffix = generateRandomSuffix(SUFFIX_LENGTH)
  return `${prefix}-${suffix}`
}

function generateRandomSuffix(length: number): string {
  // Caracteres seguros e sem ambiguidades visuais (sem 0, O, 1, I)
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const bytes = crypto.randomBytes(length)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length]
  }
  return result
}
