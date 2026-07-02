import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  BadRequestException,
  UnprocessableEntityException,
  MethodNotAllowedException,
} from '@nestjs/common';
import { Response } from 'express';
import { IResponse } from '../interfaces/response.interface';
import { Error as MongooseError } from 'mongoose';
import { TypeORMError } from 'typeorm';

// Exception filter for all modules
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status;
    let message;
    let errorName;
    if (exception instanceof UnprocessableEntityException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = exceptionResponse['message'][0];
      errorName = exception.name;
    } else if (exception instanceof MethodNotAllowedException) {
      status = exception.getStatus();
      message = exception.message;
      errorName = exception.name;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else {
        const respMessage = exceptionResponse['message'];
        message = Array.isArray(respMessage)
          ? respMessage[0]
          : (respMessage ?? exception.message);
      }
      errorName = exception.name;
    } else if (exception instanceof MongooseError.ValidationError) {
      status = 400; // Bad Request
      message = exception.message;
      errorName = 'ValidationError';
    } else if (exception instanceof MongooseError.CastError) {
      status = 400; // Bad Request
      message = 'Invalid ID format';
      errorName = 'CastError';
    } else if (exception instanceof TypeORMError) {
      status = 400; // Bad Request
      message = exception.message;
      errorName = 'TypeORMError';
    } else {
      status = 500; // Internal Server Error
      message = 'Internal Server Error';
      errorName = 'InternalServerError';
    }
    const data: IResponse = {
      status: 'fail',
      statusCode: status,
      message: message,
      error: {
        name: errorName,
      },
    };

    response.status(status).json(data);
  }
}
