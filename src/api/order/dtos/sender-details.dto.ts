import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SenderDetailDTO {
  @IsNotEmpty({ message: 'guestFullName is required' })
  @IsString({ message: 'guestFullName must be a string' })
  @ApiProperty({ description: 'Full name of the sender', example: 'John Doe' })
  guestFullName: string;

  @IsNotEmpty({ message: 'guestContactNumber is required' })
  @IsString({ message: 'guestContactNumber must be a string' })
  @ApiProperty({
    description: 'Contact number of the sender',
    example: '+2348012345678',
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
