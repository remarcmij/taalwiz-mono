/// <reference types="multer" />
import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/index.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
import { ContentService } from './content.service.js';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Roles('admin')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadContent(@UploadedFile() file: Express.Multer.File) {
    return this.contentService.uploadContent(file);
  }

  @Roles('admin')
  @Post('reprocess-hashtags')
  async reprocessHashtags() {
    await this.contentService.reprocessHashtags();
    return { message: 'Hashtags reprocessed successfully' };
  }

  @Roles('admin')
  @Get('groups')
  findGroups() {
    return this.contentService.findGroups();
  }

  @Get('index')
  findPublications(@CurrentUser() user: JwtPayload) {
    return this.contentService.findPublications(user);
  }

  @Get('manifest')
  findContentManifest(@CurrentUser() user: JwtPayload) {
    return this.contentService.findContentManifest(user);
  }

  @Get('article/:filename')
  async findArticle(@Param('filename') filename: string, @CurrentUser() user: JwtPayload) {
    const article = await this.contentService.findArticle(filename, user);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  @Get(':groupName')
  findPublicationTopics(@Param('groupName') groupName: string, @CurrentUser() user: JwtPayload) {
    return this.contentService.findPublicationTopics(groupName, user);
  }

  @Delete(':filename')
  @Roles('admin')
  async deleteTopic(@Param('filename') filename: string) {
    const result = await this.contentService.deleteTopic(filename);
    if (result.deletedCount === 0) {
      throw new NotFoundException('Topic not found');
    }
    return result;
  }
}
