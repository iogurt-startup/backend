export type PasswordTokenType = 'FIRST_ACCESS' | 'RECOVERY'

export interface PasswordToken {
  id: string
  token: string
  userId: string
  type: PasswordTokenType
  expiresAt: Date
  usedAt?: Date | null
}

export interface IPasswordTokensRepository {
  create(userId: string, token: string, expiresAt: Date, type: PasswordTokenType): Promise<void>
  findByToken(token: string): Promise<PasswordToken | null>
  /** Marca o token como usado apenas se ainda estiver pendente; retorna false se já havia sido consumido. */
  markAsUsed(token: string): Promise<boolean>
  /** Sem `type`, invalida os tokens pendentes de todos os tipos. */
  invalidatePreviousTokens(userId: string, type?: PasswordTokenType): Promise<void>
}
