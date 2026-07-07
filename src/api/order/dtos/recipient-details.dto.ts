import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { normalizePhoneNumber } from 'src/helpers/normalize-phone-number';

export class RecipientDetailDTO {
  @IsNotEmpty({ message: 'recipient full name is required' })
  @IsString({ message: 'recipient full name must be a string' })
  @ApiProperty({
    description: 'Full name of the recipient',
    example: 'Jane Doe',
  })
  recipientFullName: string;

  @IsNotEmpty({ message: 'recipient contact number is required' })
  @IsString({ message: 'recipient contact number must be a string' })
  @Transform(({ value }) => (value ? normalizePhoneNumber(String(value).trim()) : value))
  @ApiProperty({
    description: 'Contact number of the recipient (local or international format)',
    example: '08012345678',
  })
  recipientContactNumber: string;

  @IsOptional()
  @IsString({ message: 'recipient email must be a string' })
  @ApiPropertyOptional({
    description: 'Email of the recipient (optional)',
    example: 'adeyemiolamide@gmail.com',
  })
  recipientEmail?: string;
}
