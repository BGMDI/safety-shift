import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common'
import { Request, Response } from 'express'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'خطأ داخلي في الخادم'

    // Never expose stack traces to the client
    this.logger.error(exception)

    response.status(status).json({
      success: false,
      statusCode: status,
      message: typeof message === 'object' ? (message as { message: string }).message : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    })
  }
}
