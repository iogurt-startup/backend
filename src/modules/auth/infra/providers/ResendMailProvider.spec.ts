import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResendMailProvider } from './ResendMailProvider'
import { env } from '../../../../config/env'
import type { FastifyBaseLogger } from 'fastify'

describe('ResendMailProvider', () => {
  let fakeLogger: {
    info: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
    warn: ReturnType<typeof vi.fn>
  }

  beforeEach(() => {
    fakeLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    }
    env.RESEND_API_KEY = 're_test_123'
    env.MAIL_FROM = 'noreply@iougurt.com'
  })

  it('deve logar aviso e não lançar erro se Resend não estiver configurado ao enviar e-mail', async () => {
    env.RESEND_API_KEY = ''
    const provider = new ResendMailProvider(fakeLogger as unknown as FastifyBaseLogger)

    await expect(
      provider.sendMail({
        to: 'tutor@exemplo.com',
        subject: 'Primeiro Acesso',
        html: '<p>Teste</p>',
      }),
    ).resolves.not.toThrow()

    expect(fakeLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tutor@exemplo.com' }),
      expect.stringContaining('não está configurado'),
    )
  })

  it('deve lançar ServiceUnavailable em assertConfigured quando não configurado', () => {
    env.RESEND_API_KEY = ''
    const provider = new ResendMailProvider(fakeLogger as unknown as FastifyBaseLogger)

    expect(() => provider.assertConfigured()).toThrowError(
      'Serviço de e-mail indisponível no momento.',
    )
  })

  it('não deve lançar exceção 500 se a API do Resend retornar erro na resposta', async () => {
    const provider = new ResendMailProvider(fakeLogger as unknown as FastifyBaseLogger)
    // Mock do client Resend
    ;(provider as unknown as { client: { emails: { send: unknown } } }).client = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Invalid API key', name: 'validation_error' },
        }),
      },
    }

    await expect(
      provider.sendMail({
        to: 'tutor@exemplo.com',
        subject: 'Primeiro Acesso',
        html: '<p>Teste</p>',
      }),
    ).resolves.not.toThrow()

    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tutor@exemplo.com' }),
      'Falha ao enviar e-mail via Resend',
    )
  })

  it('não deve lançar exceção 500 se o cliente Resend rejeitar com erro de rede assíncrono', async () => {
    const provider = new ResendMailProvider(fakeLogger as unknown as FastifyBaseLogger)
    ;(provider as unknown as { client: { emails: { send: unknown } } }).client = {
      emails: {
        send: vi.fn().mockRejectedValue(new Error('ETIMEDOUT: Connection timed out')),
      },
    }

    await expect(
      provider.sendMail({
        to: 'tutor@exemplo.com',
        subject: 'Primeiro Acesso',
        html: '<p>Teste</p>',
      }),
    ).resolves.not.toThrow()

    expect(fakeLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'tutor@exemplo.com' }),
      'Erro inesperado na comunicação com o serviço Resend',
    )
  })

  it('deve registrar sucesso quando o e-mail for enviado sem erros', async () => {
    const provider = new ResendMailProvider(fakeLogger as unknown as FastifyBaseLogger)
    ;(provider as unknown as { client: { emails: { send: unknown } } }).client = {
      emails: {
        send: vi.fn().mockResolvedValue({
          data: { id: 'email-id-123' },
          error: null,
        }),
      },
    }

    await expect(
      provider.sendMail({
        to: 'tutor@exemplo.com',
        subject: 'Primeiro Acesso',
        html: '<p>Teste</p>',
      }),
    ).resolves.not.toThrow()

    expect(fakeLogger.info).toHaveBeenCalledWith(
      { emailId: 'email-id-123', to: 'tutor@exemplo.com' },
      'E-mail enviado com sucesso',
    )
  })
})
