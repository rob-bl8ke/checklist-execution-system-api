import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { RemindersService } from './reminders.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { UpdateReminderOccurrenceDto } from './dto/update-reminder-occurrence.dto';

@Controller('reminders')
export class RemindersController {
  constructor(private readonly remindersService: RemindersService) {}

  @Get()
  findAll(
    @Query('active') active?: string,
    @Query('linkedTemplateId') linkedTemplateId?: string,
    @Query('category') category?: string,
  ) {
    return this.remindersService.findAll({
      active: active !== undefined ? active === 'true' : undefined,
      linkedTemplateId:
        linkedTemplateId !== undefined ? Number(linkedTemplateId) : undefined,
      category,
    });
  }

  // NOTE: /agenda must be declared before /:id to prevent "agenda" being
  // consumed as an id path parameter.
  @Get('agenda')
  getAgenda(@Query('from') from?: string, @Query('to') to?: string) {
    if (!from || !to) {
      throw new BadRequestException('from and to query parameters are required');
    }

    if (from > to) {
      throw new BadRequestException('from must not be after to');
    }

    const DAY_MS = 86_400_000;
    const fromMs = new Date(`${from}T00:00:00Z`).getTime();
    const toMs = new Date(`${to}T00:00:00Z`).getTime();
    const windowDays = Math.round((toMs - fromMs) / DAY_MS);

    if (windowDays > 90) {
      throw new BadRequestException('Agenda window must not exceed 90 days');
    }

    return this.remindersService.getAgenda(from, to);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.remindersService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReminderDto) {
    return this.remindersService.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReminderDto,
  ) {
    return this.remindersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.remindersService.remove(id);
  }

  @Patch(':id/occurrences/:occurrenceDate')
  updateOccurrenceState(
    @Param('id', ParseIntPipe) id: number,
    @Param('occurrenceDate') occurrenceDate: string,
    @Body() dto: UpdateReminderOccurrenceDto,
  ) {
    return this.remindersService.updateOccurrenceState(id, occurrenceDate, dto);
  }
}
