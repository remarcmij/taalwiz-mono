import { Controller, Get, Param, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
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
  findArticle(@Param('filename') filename: string) {
    return this.contentService.findArticle(filename);
  }
}
