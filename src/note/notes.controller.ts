import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { NotesService, TagMode } from './notes.service';
import { CreateNoteDto } from './dto/create-note.dto';
import { UpdateNoteDto } from './dto/update-note.dto';

@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get('tags')
  findAllTags() {
    return this.notesService.findAllTags();
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('tags') tags?: string | string[],
    @Query('tagMode') tagMode?: string,
  ) {
    const parsedPage = page ? parseInt(page, 10) : 1;
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const parsedTags = tags
      ? Array.isArray(tags)
        ? tags
        : [tags]
      : undefined;
    const parsedTagMode: TagMode =
      tagMode === 'all' ? 'all' : 'any';

    return this.notesService.findAll(
      parsedPage,
      parsedLimit,
      search,
      parsedTags,
      parsedTagMode,
    );
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateNoteDto) {
    return this.notesService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateNoteDto) {
    return this.notesService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.remove(id);
  }
}
