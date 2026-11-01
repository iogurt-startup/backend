import { randomBytes } from 'crypto'
import { AppError } from '../../../shared/errors/app-error'
import { prisma } from '@config/prisma'
import { generateClinicCode } from '../../../shared/utils/generateClinicCode'
import type { IUsersRepository } from '../repositories/IUsersRepository'
import type { IRefreshTokensRepository } from '../repositories/IRefreshTokensRepository'

const REFRESH_EXPIRES_DAYS = 7

interface GoogleAuthInput {
  accessToken: string // access_token vindo do flow 'implicit' do Google
}

interface GoogleAuthOutput {
  user: { id: string; name: string; email: string; role: string; clinicId: string; crmv: string | null }
  refreshToken: string
  isNewUser: boolean
}

interface GoogleUserInfo {
  sub: string
  email: string
  name: string
  picture?: string
  email_verified: boolean
}

export class GoogleAuthUseCase {
  constructor(
    private usersRepository: IUsersRepository,
    private refreshTokensRepository: IRefreshTokensRepository,
  ) {}

  async execute({ accessToken }: GoogleAuthInput): Promise<GoogleAuthOutput> {
    // 1. Verifica o access_token com o endpoint userinfo do Google
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })

    if (!res.ok) {
      throw new AppError('Token do Google inválido ou expirado.', 401)
    }

    const googleUser = (await res.json()) as GoogleUserInfo

    if (!googleUser.email || !googleUser.email_verified) {
      throw new AppError('Conta Google sem e-mail verificado.', 400)
    }

    // 2. Busca ou cria o usuário
    let isNewUser = false
    let user = await this.usersRepository.findByEmail(googleUser.email.toLowerCase())

    if (!user) {
      // Novo usuário Google: cria uma clínica automaticamente com nome provisório
      const clinicName = `Clínica de ${googleUser.name ?? googleUser.email.split('@')[0]}`
      const clinic = await prisma.clinic.create({
        data: {
          name: clinicName,
          code: generateClinicCode(clinicName),
        },
      })
      const dummyPassword = randomBytes(32).toString('hex')
      user = await this.usersRepository.create({
        email: googleUser.email.toLowerCase(),
        passwordHash: dummyPassword,
        name: googleUser.name ?? googleUser.email.split('@')[0],
        role: 'OWNER', // primeiro usuário de uma clínica Google é OWNER
        clinicId: clinic.id,
      })
      isNewUser = true
    }

    // 3. Gera refresh token
    const tokenValue = randomBytes(32).toString('hex')
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS)

    await this.refreshTokensRepository.create({
      token: tokenValue,
      userId: user.id,
      expiresAt,
    })

    return {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, clinicId: user.clinicId, crmv: user.crmv ?? null },
      refreshToken: tokenValue,
      isNewUser,
    }
  }
}
