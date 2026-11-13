import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Page } from './entities/page.entity';
import { PageRevision } from './entities/page-revision.entity';
import { PageSlug } from './entities/page-slug.entity';
import { Redirect } from './entities/redirect.entity';
import { WebsitePagesController } from './pages/website-pages.controller';
import { WebsiteRoutesController } from './routes/website-routes.controller';
import { CmsSeedService } from './seed/cms-seed.service';
import { PagesService } from './services/pages.service';
import { RedirectsService } from './services/redirects.service';
import { RevalidationService } from './services/revalidation.service';
import { RoutesService } from './services/routes.service';
import { WebsiteContentService } from './services/website-content.service';

/**
 * CMS pages: public reads for the website (`/pages`, `/routes`) and the services the admin
 * panel's pages and redirects endpoints use (src/admin/{pages,redirects}).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Page, PageRevision, PageSlug, Redirect])],
  controllers: [WebsitePagesController, WebsiteRoutesController],
  providers: [
    RevalidationService,
    RoutesService,
    WebsiteContentService,
    PagesService,
    RedirectsService,
    CmsSeedService,
  ],
  exports: [RevalidationService, PagesService, RedirectsService],
})
export class CmsModule {}
