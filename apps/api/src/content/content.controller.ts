import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseArrayPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/index.js';
import type { Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ContentService } from './content.service.js';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Roles('admin')
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  uploadContent(@UploadedFile() file: Express.Multer.File, @Res() response: Response) {
    return this.contentService.uploadContent(file, response);
  }

  @Get('index')
  findIndexTopics() {
    return this.contentService.findIndexTopics();
  }

  @Get(':groupName')
  findPublicationTopics(@Param('groupName') groupName: string) {
    return this.contentService.findPublicationTopics(groupName);
  }

  @Get('article/:filename')
  async findArticle(@Param('filename') filename: string) {
    const article = await this.contentService.findArticle(filename);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
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

  @Patch('sort')
  @Roles('admin')
  async updateSortIndices(@Body(new ParseArrayPipe({ items: String })) ids: string[]) {
    try {
      await this.contentService.updateSortIndices(ids);
    } catch (_) {
      throw new NotFoundException('One or more topics not found');
    }
  }
}
