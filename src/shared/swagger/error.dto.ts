import { ApiProperty } from '@nestjs/swagger';

class ErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code: string;

  @ApiProperty({ example: 'Request validation failed' })
  message: string;

  @ApiProperty({ required: false, nullable: true })
  details?: unknown;

  @ApiProperty({ required: false, nullable: true })
  requestId?: string;
}

// Standard error envelope returned by the global exception filter.
export class ErrorDto {
  @ApiProperty({ type: ErrorBodyDto })
  error: ErrorBodyDto;
}
