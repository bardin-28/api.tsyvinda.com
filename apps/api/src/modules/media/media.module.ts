import { Global, Module, type OnApplicationBootstrap, Injectable } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { logger } from '../../shared/logger';
import { Page } from '../cms/entities/page.entity';
import { PostTranslation } from '../posts/entities/post-translation.entity';
import { User } from '../users/entities/user.entity';
import { Media } from './entities/media.entity';
import { MediaService } from './media.service';

/** Registers images content already uses, on every boot (idempotent, never blocks startup). */
@Injectable()
export class MediaImportService implements OnApplicationBootstrap {
  constructor(private readonly media: MediaService) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const added = await this.media.importExisting();
      if (added > 0) logger.info({ added }, 'Media library: imported existing images');
    } catch (error) {
      logger.error({ err: error }, 'Media library import failed');
    }
  }
}

/**
 * The media library, global: posts, users and pages store uploads through MediaService and
 * delete images through it (only once nothing uses them).
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Media, PostTranslation, User, Page])],
  providers: [MediaService, MediaImportService],
  exports: [MediaService],
})
export class MediaModule {}
