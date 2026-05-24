/// <reference types="multer" />
import {
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express/multer/interceptors/index.js';
import type { Request, Response } from 'express';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../auth/types/jwtpayload.interface.js';
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

  @Roles('admin')
  @Get('groups')
  findGroups() {
    return this.contentService.findGroups();
  }

  @Get('index')
  findPublications(@Req() req: Request) {
    return this.contentService.findPublications(req['user'] as JwtPayload);
  }

  @Get('manifest')
  findContentManifest(@Req() req: Request) {
    return this.contentService.findContentManifest(req['user'] as JwtPayload);
  }

  @Get('article/:filename')
  async findArticle(@Param('filename') filename: string) {
    const article = await this.contentService.findArticle(filename);
    if (!article) {
      throw new NotFoundException('Article not found');
    }
    return article;
  }

  @Get(':groupName')
  findPublicationTopics(@Param('groupName') groupName: string, @Req() req: Request) {
    return this.contentService.findPublicationTopics(groupName, req['user'] as JwtPayload);
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
