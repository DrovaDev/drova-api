import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { UserType } from 'src/constants';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    if (!token) {
      throw new UnauthorizedException();
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });
    } catch {
      throw new UnauthorizedException();
    }

    // For riders, validate the sessionId matches what's stored in the DB.
    // This invalidates tokens from previous logins after a logout or re-login.
    if (payload.userType === UserType.RIDER && payload.riderId) {
      if (!payload.sessionId) {
        throw new UnauthorizedException('Invalid session');
      }
      const rows = await this.dataSource.query<{ sessionId: string | null }[]>(
        `SELECT "sessionId" FROM rider WHERE id = $1 AND "isDeleted" = false LIMIT 1`,
        [payload.riderId],
      );
      if (!rows.length || rows[0].sessionId !== payload.sessionId) {
        throw new UnauthorizedException('Session expired. Please log in again.');
      }
    }

    request['auth'] = payload;
    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
