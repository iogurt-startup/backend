import type {
  IPasswordTokensRepository,
  PasswordToken,
  PasswordTokenType,
} from '../IPasswordTokensRepository'

export class InMemoryPasswordTokensRepository implements IPasswordTokensRepository {
  public items: PasswordToken[] = []

  async create(userId: string, token: string, expiresAt: Date, type: PasswordTokenType): Promise<void> {
    this.items.push({
      id: `token-${this.items.length + 1}`,
      userId,
      token,
      type,
      expiresAt,
      usedAt: null,
    })
  }

  async findByToken(token: string): Promise<PasswordToken | null> {
    return this.items.find(item => item.token === token) ?? null
  }

  async markAsUsed(token: string): Promise<boolean> {
    const item = this.items.find(passwordToken => passwordToken.token === token && !passwordToken.usedAt)
    if (!item) return false
    item.usedAt = new Date()
    return true
  }

  async invalidatePreviousTokens(userId: string, type?: PasswordTokenType): Promise<void> {
    this.items.forEach(item => {
      if (item.userId === userId && !item.usedAt && (!type || item.type === type)) {
        item.usedAt = new Date()
      }
    })
  }
}
