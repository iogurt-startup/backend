import { AppError } from '../errors/app-error'
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'

export function errorHandler(
  error: FastifyError | AppError | ZodError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  console.error(`\n[ErrorHandler] Error on ${_request.method} ${_request.url}:`, error)
  if (_request.body) console.error(`[ErrorHandler] Payload:`, JSON.stringify(_request.body, null, 2))

  // Zod validation errors via Fastify hook
  if ('validation' in error && Array.isArray((error as any).validation)) {
    const rawIssues = (error as any).validation
    const issues: Record<string, string[]> = {}
    for (const i of rawIssues) {
      const field =
        i.params?.issue?.path?.join('.') ||
        (typeof i.instancePath === 'string' ? i.instancePath.replace(/^\//, '').replace(/\//g, '.') : '') ||
        '_root'
      if (!issues[field]) issues[field] = []
      issues[field].push(i.message)
    }
    console.error(`[ErrorHandler] Zod Validation Error issues:`, JSON.stringify(issues, null, 2))
    return reply.status(422).send({
      statusCode: 422,
      error: 'Validation Error',
      issues,
      message: 'Erros de validação: ' + rawIssues.map((i: any) => `${i.params?.issue?.path?.join('.') || i.instancePath}: ${i.message}`).join(', ')
    })
  }

  // Zod validation errors direct manual parse
  if (error instanceof ZodError) {
    const issues = error.flatten().fieldErrors
    console.error(`[ErrorHandler] Zod Validation Error issues:`, issues)
    return reply.status(422).send({
      statusCode: 422,
      error: 'Validation Error',
      issues: issues,
      message: 'Erros de validação nos campos'
    })
  }

  // AppError (domain errors from Use Cases)
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.message,
    })
  }

  // Fastify built-in errors (e.g. 404 Not Found)
  if ('statusCode' in error && error.statusCode) {
    return reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      error: error.message,
    })
  }

  // Unhandled errors
  console.error(error)
  return reply.status(500).send({
    statusCode: 500,
    error: 'Internal Server Error',
  })
}
