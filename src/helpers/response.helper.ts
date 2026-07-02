import { IResponse } from 'src/interfaces/response.interface';

export function successResponse(
  message: string,
  data?: any,
  opts?: { statusCode?: number; meta?: IResponse['meta'] },
): IResponse {
  return {
    status: 'success',
    statusCode: opts?.statusCode ?? 200,
    message,
    data,
    meta: opts?.meta,
  };
}
