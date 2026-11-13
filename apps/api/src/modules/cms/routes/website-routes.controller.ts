import { Controller, Get, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ErrorDto } from '../../../shared/swagger/error.dto';
import { CONTENT_READ_THROTTLE } from '../cms.throttle';
import { RoutesService } from '../services/routes.service';
import { ResolveRouteQueryDto } from './resolve-route.query';
import { WebsiteRouteMapDto, WebsiteRouteResolutionDto } from './route.response';

@ApiTags('Pages')
@Throttle(CONTENT_READ_THROTTLE)
@Controller('routes')
export class WebsiteRoutesController {
  constructor(private readonly routes: RoutesService) {}

  @Get()
  @ApiOperation({ summary: 'Path of every published page per language (menus, sitemap)' })
  @ApiOkResponse({ type: WebsiteRouteMapDto })
  map() {
    return this.routes.routeMap();
  }

  @Get('resolve')
  @ApiOperation({
    summary:
      'What lives at a path: a page, a blog post, or a redirect (old / other-language address, admin redirect)',
  })
  @ApiOkResponse({ type: WebsiteRouteResolutionDto })
  @ApiResponse({ status: 404, description: 'Nothing at this path', type: ErrorDto })
  resolve(@Query() query: ResolveRouteQueryDto) {
    return this.routes.resolve(query.path, query.locale);
  }
}
