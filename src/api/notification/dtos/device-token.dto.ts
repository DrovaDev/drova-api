import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceTokenDTO {
  @IsNotEmpty({ message: 'deviceId is required' })
  @IsString({ message: 'deviceId must be a string' })
  @ApiProperty({
    description: 'Unique device identifier generated on first app launch',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  deviceId: string;

  @IsNotEmpty({ message: 'deviceToken is required' })
  @IsString({ message: 'deviceToken must be a string' })
  @ApiProperty({
    description: 'Expo push notification token for this device',
    example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]',
  })
  deviceToken: string;
}

export class RemoveDeviceTokenDTO {
  @IsOptional()
  @IsString({ message: 'deviceToken must be a string' })
  @ApiPropertyOptional({
    description: 'Device token to deactivate',
  })
  deviceToken?: string;
}
