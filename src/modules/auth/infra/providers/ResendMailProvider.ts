import { Resend } from 'resend'
import { Errors } from '../../../../core/errors'
import { env } from '../../../../config/env'
import { FastifyBaseLogger } from 'fastify'
import type { IMailProvider, SendMailData } from '../../providers/IMailProvider'

export class ResendMailProvider implements IMailProvider {
  // O SDK lança "Missing API key" se o cliente for criado sem chave. Por isso ele é
  // criado só quando há um envio configurado, e não na construção do provider.
  private client?: Resend

  constructor(private logger?: FastifyBaseLogger) {}

  private getClient(): Resend {
    this.client ??= new Resend(env.RESEND_API_KEY)
    return this.client
  }

  isConfigured(): boolean {
    return env.RESEND_API_KEY.length > 0 && env.MAIL_FROM.length > 0
  }

  assertConfigured(): void {
    if (this.isConfigured()) return

    this.logger?.error('Serviço de e-mail indisponível: RESEND_API_KEY ou MAIL_FROM não configurados')
    throw Errors.serviceUnavailable('Serviço de e-mail indisponível no momento.')
  }

  async sendMail({ to, subject, html }: SendMailData): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger?.warn({ to }, 'Envio de e-mail cancelado: Resend não está configurado.')
      return false
    }

    try {
      const response = await this.getClient().emails.send({
        from: env.MAIL_FROM,
        to,
        subject,
        html,
      })

      if (response.error) {
        this.logger?.error({ error: response.error, to }, 'Falha ao enviar e-mail via Resend')
        return false
      }

      this.logger?.info({ emailId: response.data?.id, to }, 'E-mail enviado com sucesso')
      return true
    } catch (error) {
      this.logger?.error({ error, to }, 'Erro inesperado na comunicação com o serviço Resend')
      return false
    }
  }
}
