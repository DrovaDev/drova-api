import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Auth } from './schemas/auth.schema';
import { Otp } from './schemas/otp.schema';
import { AuthenticationDb } from './authentication.db';

@Module({
  imports: [TypeOrmModule.forFeature([Auth, Otp])],
  providers: [AuthenticationDb],
  exports: [AuthenticationDb],
})
export class AuthenticationDataModule {}
