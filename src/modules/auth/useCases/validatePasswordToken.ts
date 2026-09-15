import jwt from 'jsonwebtoken'
import { env } from '../../../config/env'
import { Errors } from '../../../core/errors'
import type {
  IPasswordTokensRepository,
  PasswordToken,
  PasswordTokenType,
} from '../repositories/IPasswordTokensRepository'

const PURPOSE_BY_TYPE: Record<PasswordTokenType, string> = {
  FIRST_ACCESS: 'first-access',
  RECOVERY: 'password-reset',
}

function secretFor(type: PasswordTokenType): string {
  // Espelha a assinatura do SendFirstAccessInviteUseCase, que usa JWT_SECRET como fallback
  return type === 'FIRST_ACCESS'
    ? env.PASSWORD_RESET_SECRET || env.JWT_SECRET
    : env.PASSWORD_RESET_SECRET
}

export async function findValidPasswordToken(
  passwordTokensRepository: IPasswordTokensRepository,
  token: string,
): Promise<PasswordToken> {
  const storedToken = await passwordTokensRepository.findByToken(token)

  if (!storedToken) {
    throw Errors.notFound('Token não encontrado.')
  }

  if (storedToken.usedAt || storedToken.expiresAt < new Date()) {
    throw Errors.badRequest('Token expirado ou já utilizado.')
  }

  const secret = secretFor(storedToken.type)
  if (!secret) {
    throw Errors.serviceUnavailable('Definição de senha indisponível no momento.')
  }

  let payload: string | jwt.JwtPayload
  try {
    payload = jwt.verify(token, secret)
  } catch {
    throw Errors.badRequest('Token inválido ou expirado.')
  }

  if (
    typeof payload !== 'object' ||
    payload.sub !== storedToken.userId ||
    payload.purpose !== PURPOSE_BY_TYPE[storedToken.type]
  ) {
    throw Errors.badRequest('Token inválido ou expirado.')
  }

  return storedToken
}
