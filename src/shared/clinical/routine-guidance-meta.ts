/** Mesmo contrato do frontend (`frontend/src/lib/clinicalRecordContent.ts`). */
const ROUTINE_GUIDANCE_META_PREFIX = '__IOUGURT_META__:'

export function parseRoutineGuidanceMeta(value?: string | null): {
  observations: string
  additionalObservations: string
} {
  if (!value) {
    return { observations: '', additionalObservations: '' }
  }

  if (value.startsWith(ROUTINE_GUIDANCE_META_PREFIX)) {
    try {
      const parsed = JSON.parse(value.slice(ROUTINE_GUIDANCE_META_PREFIX.length)) as {
        observations?: string
        additionalObservations?: string
      }
      return {
        observations: parsed.observations ?? '',
        additionalObservations: parsed.additionalObservations ?? '',
      }
    } catch {
      return { observations: '', additionalObservations: value }
    }
  }

  return { observations: '', additionalObservations: value }
}

/** Texto legível para PDF / impressão (sem JSON nem prefixo interno). */
export function routineGuidanceToPlainText(value?: string | null): string {
  const { observations, additionalObservations } = parseRoutineGuidanceMeta(value)
  return joinSections([observations, additionalObservations])
}

/**
 * CLI-01 — lê as observações do atendimento de onde elas estiverem.
 *
 * Depois da migração, `observations` tem campo próprio e `routineGuidance`
 * guarda só texto limpo. Mas um cliente antigo ainda pode gravar o JSON
 * improvisado em `routineGuidance`, então continuamos aceitando os dois
 * formatos: o campo próprio ganha, o legado serve de fallback.
 */
export function resolveClinicalObservations(record: {
  observations?: string | null
  routineGuidance?: string | null
}): { observations: string; additionalObservations: string } {
  const legacy = parseRoutineGuidanceMeta(record.routineGuidance)
  const own = record.observations?.trim() ?? ''

  return {
    observations: own || legacy.observations,
    additionalObservations: legacy.additionalObservations,
  }
}

/** Mesmo que `resolveClinicalObservations`, já pronto para imprimir. */
export function clinicalObservationsToPlainText(record: {
  observations?: string | null
  routineGuidance?: string | null
}): string {
  const { observations, additionalObservations } = resolveClinicalObservations(record)
  return joinSections([observations, additionalObservations])
}

function joinSections(sections: string[]): string {
  return sections
    .map(section => section.trim())
    .filter(Boolean)
    .join('\n\n')
}
