import { AppError } from '../shared/errors/app-error'

export const Errors = {
  unauthorized: (message = 'Não autorizado') =>
    new AppError(message, 401),

  forbidden: (message = 'Acesso negado') =>
    new AppError(message, 403),

  notFound: (message = 'Recurso não encontrado') =>
    new AppError(message, 404),

  conflict: (message = 'Conflito de dados') =>
    new AppError(message, 409),

  badRequest: (message = 'Requisição inválida') =>
    new AppError(message, 400),

  serviceUnavailable: (message = 'Serviço indisponível') =>
    new AppError(message, 503),

  internal: (message = 'Erro interno do servidor') =>
    new AppError(message, 500),
}
