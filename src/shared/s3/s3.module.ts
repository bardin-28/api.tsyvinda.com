import { Global, Module } from '@nestjs/common';
import { S3Service } from './s3.service';

// Global so feature modules can inject S3Service without re-importing.
@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
