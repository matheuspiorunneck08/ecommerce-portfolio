import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../errors';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof AppError) {
      response.status(exception.statusCode).json({
        error: { code: exception.code, message: exception.message },
      });
      return;
    }

    // Prisma constraint failures — map to 4xx instead of leaking a 500
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        response.status(409).json({
          error: { code: 'CONFLICT', message: 'Resource already exists' },
        });
        return;
      }
      if (exception.code === 'P2003') {
        response.status(409).json({
          error: { code: 'INVALID_REFERENCE', message: 'Referenced resource does not exist' },
        });
        return;
      }
      if (exception.code === 'P2025') {
        response.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Resource not found' },
        });
        return;
      }
    }

    // Nest's own HttpException (e.g. from ValidationPipe)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : (body as { message: string }).message;
      response.status(status).json({
        error: { code: 'BAD_REQUEST', message },
      });
      return;
    }

    this.logger.error(exception instanceof Error ? exception.stack : exception);
    response.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
    });
  }
}
