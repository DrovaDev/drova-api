import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches } from 'class-validator';

const PIN_REGEX = /^\d{4}$/;
const PIN_MESSAGE = 'PIN must be exactly 4 digits';

export class SetWithdrawalPinDTO {
  @IsNotEmpty()
  @IsString()
  @Matches(PIN_REGEX, { message: PIN_MESSAGE })
  @ApiProperty({
    description: '4-digit numeric withdrawal PIN',
    example: '1234',
  })
  pin: string;
}

export class UpdateWithdrawalPinDTO {
  @IsNotEmpty()
  @IsString()
  @Matches(PIN_REGEX, { message: PIN_MESSAGE })
  @ApiProperty({
    description: 'Current withdrawal PIN',
    example: '1234',
  })
  currentPin: string;

  @IsNotEmpty()
  @IsString()
  @Matches(PIN_REGEX, { message: PIN_MESSAGE })
  @ApiProperty({
    description: 'New 4-digit withdrawal PIN',
    example: '5678',
  })
  newPin: string;
}
