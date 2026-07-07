import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';
import { normalizePhoneNumber } from 'src/helpers/normalize-phone-number';

export class SenderDetailDTO {
  @IsNotEmpty({ message: 'guestFullName is required' })
  @IsString({ message: 'guestFullName must be a string' })
  @ApiProperty({ description: 'Full name of the sender', example: 'John Doe' })
  guestFullName: string;

  @IsNotEmpty({ message: 'guestContactNumber is required' })
  @IsString({ message: 'guestContactNumber must be a string' })
  @Transform(({ value }) => (value ? normalizePhoneNumber(String(value).trim()) : value))
  @ApiProperty({
    description: 'Contact number of the sender (local or international format)',
    example: '08012345678',
  })
  guestContactNumber: string;

  @IsNotEmpty({ message: 'guestEmail is required' })
  @IsString({ message: 'guestEmail must be a string' })
  @ApiProperty({
    description: 'Email of the sender',
    example: 'john@example.com',
  })
  guestEmail: string;
}
