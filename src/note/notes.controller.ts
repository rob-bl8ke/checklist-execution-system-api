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
import { CreateNoteVersionDto } from './dto/create-note-version.dto';
import { GenerateNoteDto } from './dto/generate-note.dto';

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

  // ---------------------------------------------------------------------------
  // Version endpoints
  // ---------------------------------------------------------------------------

  @Get(':id/versions')
  listVersions(@Param('id', ParseIntPipe) id: number) {
    return this.notesService.listVersions(id);
  }

  @Post(':id/versions')
  @HttpCode(HttpStatus.CREATED)
  createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateNoteVersionDto,
  ) {
    return this.notesService.createVersion(id, dto);
  }

  @Post(':id/versions/:versionId/restore')
  @HttpCode(HttpStatus.OK)
  restoreVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.notesService.restoreVersion(id, versionId);
  }

  // ---------------------------------------------------------------------------
  // Variable generation (ephemeral)
  // ---------------------------------------------------------------------------

  @Post(':id/generate')
  @HttpCode(HttpStatus.OK)
  async generate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateNoteDto,
  ) {
    const rendered = await this.notesService.generate(id, dto.variables ?? {});
    return { rendered };
  }
}
