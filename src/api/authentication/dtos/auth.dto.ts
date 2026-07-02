import {
  ApiProperty,
  ApiPropertyOptional,
  IntersectionType,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsEnum,
} from 'class-validator';
import { UserType } from 'src/constants';

class BaseEmailDTO {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  @ApiProperty({
    description: 'User email address',
    example: 'example@gmail.com',
  })
  email: string;
}

class BaseTempTokenDTO {
  @IsString({ message: 'tempToken must be a string' })
  @IsNotEmpty({ message: 'tempToken is required' })
  @ApiProperty({
    description: 'Temporary JWT token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  tempToken!: string;
}

class BaseNewPasswordDTO {
  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @ApiProperty({
    description: 'New password',
    example: 'NewStrongPassword123!',
  })
  newPassword!: string;

  @IsString({ message: 'Confirm password must be a string' })
  @IsNotEmpty({ message: 'Confirm password is required' })
  @ApiProperty({
    description: 'Confirm new password',
    example: 'NewStrongPassword123!',
  })
  confirmPassword!: string;
}

export class UserRegistrationDTO extends BaseEmailDTO {
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @ApiProperty({ description: 'User password', example: 'StrongPassword123!' })
  password: string;

  @IsEnum(UserType, {
    message: `User type must be one of the following: ${Object.values(UserType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'User type is required' })
  @ApiProperty({
    description: 'Type of user registering',
    example: UserType.BUSINESS,
    enum: UserType,
  })
  userType: UserType;
}

export class EmailVerificationDTO extends BaseEmailDTO {
  @IsString({ message: 'OTP must be a string' })
  @IsNotEmpty({ message: 'OTP is required' })
  @ApiProperty({
    description: 'One-time password for email verification',
    example: '123456',
  })
  otp: string;
}

export class SendOTPDTO extends BaseEmailDTO {}

export class ForgotPasswordDTO extends BaseEmailDTO {}

export class ValidateOtpDTO extends BaseTempTokenDTO {
  @IsString({ message: 'OTP must be a string' })
  @IsNotEmpty({ message: 'OTP is required' })
  @ApiProperty({
    description: 'One-time password for email verification',
    example: '123456',
  })
  otp: string;
}

export class ValidateRiderOtpDTO extends ValidateOtpDTO {
  @IsString({ message: 'deviceId must be a string' })
  @IsNotEmpty({ message: 'deviceId is required' })
  @ApiProperty({
    description: 'Unique device identifier generated on first app launch',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  deviceId!: string;
}

export class ChangePasswordDTO extends IntersectionType(
  BaseTempTokenDTO,
  BaseNewPasswordDTO,
) {}

export class LoginDTO {
  @IsOptional()
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @ApiPropertyOptional({
    description: 'User email address (required for business/staff login)',
    example: 'example@gmail.com',
  })
  email?: string;

  @IsOptional()
  @IsString({ message: 'telephoneNumber must be a string' })
  @ApiPropertyOptional({
    description: 'User telephone number (required for rider login)',
    example: '+2348012345678',
  })
  telephoneNumber?: string;

  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @ApiPropertyOptional({
    description: 'User password',
    example: 'StrongPassword123!',
  })
  password?: string;

  @IsEnum(UserType, {
    message: `userType must be one of: ${Object.values(UserType).join(', ')}`,
  })
  @IsNotEmpty({ message: 'userType is required' })
  @ApiProperty({
    description: 'Type of user',
    example: UserType.BUSINESS,
    enum: UserType,
  })
  userType: UserType;
}

export class ValidatUserPasswordDTO {
  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password is required' })
  @ApiProperty({ description: 'User password', example: 'StrongPassword123!' })
  password: string;
}

export class ResetPasswordDTO extends BaseNewPasswordDTO {
  @IsString({ message: 'current password must be a string' })
  @IsNotEmpty({ message: 'current password is required' })
  @ApiProperty({
    description: 'Current user password',
    example: 'StrongPassword123!',
  })
  currentPassword: string;
}
