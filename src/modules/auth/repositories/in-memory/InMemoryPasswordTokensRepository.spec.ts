import { beforeEach, describe, expect, it } from 'vitest'
import { InMemoryPasswordTokensRepository } from './InMemoryPasswordTokensRepository'

describe('InMemoryPasswordTokensRepository', () => {
  let repository: InMemoryPasswordTokensRepository

  beforeEach(() => {
    repository = new InMemoryPasswordTokensRepository()
  })

  it('deve criar e buscar um token com o seu tipo', async () => {
    const expiresAt = new Date(Date.now() + 3600 * 1000)
    await repository.create('user-1', 'token-abc', expiresAt, 'FIRST_ACCESS')

    const token = await repository.findByToken('token-abc')
    expect(token).toBeDefined()
    expect(token?.userId).toBe('user-1')
    expect(token?.type).toBe('FIRST_ACCESS')
    expect(token?.usedAt).toBeNull()
  })

  it('deve marcar um token como usado apenas uma vez', async () => {
    await repository.create('user-1', 'token-abc', new Date(), 'RECOVERY')

    await expect(repository.markAsUsed('token-abc')).resolves.toBe(true)
    await expect(repository.markAsUsed('token-abc')).resolves.toBe(false)

    const token = await repository.findByToken('token-abc')
    expect(token?.usedAt).toBeInstanceOf(Date)
  })

  it('deve retornar false ao marcar um token inexistente', async () => {
    await expect(repository.markAsUsed('nao-existe')).resolves.toBe(false)
  })

  it('deve invalidar apenas tokens pendentes do usuário especificado', async () => {
    // 2 tokens para user-1 (um já usado, outro pendente)
    await repository.create('user-1', 'token-1', new Date(), 'FIRST_ACCESS')
    await repository.create('user-1', 'token-2', new Date(), 'FIRST_ACCESS')
    await repository.markAsUsed('token-1')

    // 1 token para user-2 (pendente)
    await repository.create('user-2', 'token-3', new Date(), 'FIRST_ACCESS')

    await repository.invalidatePreviousTokens('user-1')

    const token1 = await repository.findByToken('token-1')
    const token2 = await repository.findByToken('token-2')
    const token3 = await repository.findByToken('token-3')

    expect(token1?.usedAt).toBeDefined()
    expect(token2?.usedAt).toBeInstanceOf(Date)
    expect(token3?.usedAt).toBeNull()
  })

  it('deve invalidar apenas tokens do tipo informado', async () => {
    await repository.create('user-1', 'invite', new Date(), 'FIRST_ACCESS')
    await repository.create('user-1', 'recovery', new Date(), 'RECOVERY')

    await repository.invalidatePreviousTokens('user-1', 'FIRST_ACCESS')

    expect((await repository.findByToken('invite'))?.usedAt).toBeInstanceOf(Date)
    expect((await repository.findByToken('recovery'))?.usedAt).toBeNull()
  })
})
