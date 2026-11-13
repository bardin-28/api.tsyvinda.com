import { ApiProperty } from '@nestjs/swagger';
import { LOCALES, POST_STATUSES, type Locale, type PostStatus } from '@tsyvinda/shared-types';

export class PostAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty({ required: false, nullable: true })
  profileImageUrl: string | null;
}

export class PostCategoryDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ description: 'URL/filter key' })
  slug: string;
}

export class PostDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: LOCALES, description: 'Language of the translated fields' })
  locale: Locale;

  @ApiProperty({
    enum: LOCALES,
    isArray: true,
    description: 'Languages the post is translated into',
  })
  locales: Locale[];

  @ApiProperty()
  title: string;

  @ApiProperty()
  slug: string;

  @ApiProperty({ required: false, nullable: true })
  description: string | null;

  @ApiProperty()
  htmlContent: string;

  @ApiProperty({ required: false, nullable: true })
  imageUrl: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Alt text of the cover image' })
  coverAlt: string | null;

  @ApiProperty({ type: PostAuthorDto })
  author: PostAuthorDto;

  @ApiProperty({ type: [PostCategoryDto], description: 'Ordered; the first is the main one' })
  categories: PostCategoryDto[];

  @ApiProperty({ enum: POST_STATUSES })
  status: PostStatus;

  @ApiProperty({ format: 'date-time', nullable: true, description: '"Date shown" on the website' })
  publishedAt: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Empty: the title' })
  seoTitle: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Empty: the description' })
  seoDescription: string | null;

  @ApiProperty({ required: false, nullable: true, description: 'Empty: the cover image' })
  ogImageUrl: string | null;

  @ApiProperty({ required: false, nullable: true, description: "Empty: the post's own URL" })
  canonicalUrl: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt: string;
}

export class PostListDto {
  @ApiProperty({ type: [PostDto] })
  items: PostDto[];

  @ApiProperty({ required: false, nullable: true })
  nextCursor: string | null;
}
