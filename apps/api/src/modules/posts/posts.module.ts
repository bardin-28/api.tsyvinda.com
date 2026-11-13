import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Post } from './entities/post.entity';
import { PostCategory } from './entities/post-category.entity';
import { PostCategoryLink } from './entities/post-category-link.entity';
import { PostCategoryTranslation } from './entities/post-category-translation.entity';
import { PostTranslation } from './entities/post-translation.entity';
import { PostCategoriesController, PostsController } from './posts.controller';
import { PostService } from './services/post.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Post,
      PostTranslation,
      PostCategory,
      PostCategoryTranslation,
      PostCategoryLink,
      User,
    ]),
  ],
  controllers: [PostsController, PostCategoriesController],
  providers: [PostService],
})
export class PostsModule {}
