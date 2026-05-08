import { Controller, Get, Param, Query } from '@nestjs/common';
import { DictionaryService } from './dictionary.service.js';

import { FindWordParamsDto } from './dto/find-word-params.dto.js';
import { FindWordQueryDto } from './dto/find-word-query.dto.js';

@Controller('dictionary')
export class DictionaryController {
  constructor(private readonly dictionaryService: DictionaryService) {}

  @Get('find/:word/:lang')
  findWord(@Param() paramsDto: FindWordParamsDto, @Query() queryDto: FindWordQueryDto) {
    return this.dictionaryService.findWord(paramsDto, queryDto);
  }

  @Get('autocomplete/:term')
  async findAutoCompletions(@Param('term') term: string) {
    return await this.dictionaryService.findAutoCompletions(term);
  }
}
