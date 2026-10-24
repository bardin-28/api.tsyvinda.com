import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/entities/user.entity';
import { Post } from './entities/post.entity';
import { PostsController } from './posts.controller';
import { PostService } from './services/post.service';

@Module({
  imports: [TypeOrmModule.forFeature([Post, User]), AuthModule],
  controllers: [PostsController],
  providers: [PostService],
})
export class PostsModule {}
