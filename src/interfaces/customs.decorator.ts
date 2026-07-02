import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Req } from './req.interface';
import { SetMetadata } from '@nestjs/common';
import { UserType } from 'src/constants';

export const Auth = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = context.switchToHttp();
    const req: Req = ctx.getRequest();
    return { ...req.auth };
  },
);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserType[]) => SetMetadata(ROLES_KEY, roles);
