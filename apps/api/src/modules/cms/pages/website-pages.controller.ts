import { Controller, Get, Param, ParseEnumPipe, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PAGE_KEYS, type PageKey } from '@tsyvinda/shared-types';
import { ErrorDto } from '../../../shared/swagger/error.dto';
import { LocaleQueryDto } from '../../posts/dto/locale.query';
import { CONTENT_READ_THROTTLE } from '../cms.throttle';
import { WebsiteContentService } from '../services/website-content.service';
import { WebsitePageDto } from './website-page.response';

@ApiTags('Pages')
@Throttle(CONTENT_READ_THROTTLE)
@Controller('pages')
export class WebsitePagesController {
  constructor(private readonly content: WebsiteContentService) {}

  @Get(':key')
  @ApiOperation({
    summary: 'Published page in one language (sections in order)',
  })
  @ApiOkResponse({ type: WebsitePageDto })
  @ApiResponse({ status: 404, description: 'Not published in this language', type: ErrorDto })
  get(@Param('key', new ParseEnumPipe(PAGE_KEYS)) key: PageKey, @Query() query: LocaleQueryDto) {
    return this.content.getPage(key, query.locale);
  }
}
