import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PostCategoryDto, PostDto, PostListDto } from './dto/post.response';
import { PostService } from './services/post.service';
import { ListPostsQueryDto } from './dto/list-posts.query';
import { LocaleQueryDto } from './dto/locale.query';

// Blog categories for the website's filter chips. Separate route so a post slugged
// "categories" stays reachable at /posts/categories.
@ApiTags('Posts')
@Controller('post-categories')
export class PostCategoriesController {
  constructor(private readonly posts: PostService) {}

  @Get()
  @ApiOperation({ summary: 'Categories that have at least one published post' })
  @ApiOkResponse({ type: [PostCategoryDto] })
  list(@Query() query: LocaleQueryDto) {
    return this.posts.listCategories(query.locale);
  }
}

// Read-only: posts are written in the admin panel only (/admin/posts) and shown on the website.
@ApiTags('Posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostService) {}

  @Get()
  @ApiOkResponse({ type: PostListDto })
  list(@Query() query: ListPostsQueryDto) {
    return this.posts.list({
      limit: query.limit,
      cursor: query.cursor,
      category: query.category,
      locale: query.locale,
    });
  }

  @Get(':slug')
  @ApiOkResponse({ type: PostDto })
  @ApiResponse({ status: 404, description: 'No published post with this slug in this language' })
  get(@Param('slug') slug: string, @Query() query: LocaleQueryDto) {
    return this.posts.getBySlug(slug, query.locale);
  }
}
