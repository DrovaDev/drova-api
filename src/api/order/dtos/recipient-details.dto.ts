import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
  @ApiProperty({
    description: 'Contact number of the recipient',
    example: '+1234567890',
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
