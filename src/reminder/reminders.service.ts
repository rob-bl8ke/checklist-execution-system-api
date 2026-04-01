import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ReminderDefinition } from './reminder-definition.entity';
import { ReminderOccurrenceState } from './reminder-occurrence-state.entity';
import { ReminderOccurrenceStatus } from './enums/reminder-occurrence-status.enum';
import { Template } from '../template/template.entity';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { UpdateReminderOccurrenceDto } from './dto/update-reminder-occurrence.dto';
import {
  computeOccurrences,
  computeDerivedFields,
  prepStartDate,
} from './recurrence.utils';

export interface ReminderListItem {
  id: number;
  title: string;
  description: string | null;
  category: string | null;
  cadence: string;
  interval: number;
  anchorDate: string;
  weekdays: number[] | null;
  timeOfDay: string | null;
  leadTimeDays: number;
  linkedTemplateId: number | null;
  active: boolean;
  nextOccurrenceDate: string | null;
  nextPrepStartDate: string | null;
  lastCompletedOccurrenceDate: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface ReminderAgendaItem {
  reminderId: number;
  title: string;
  description: string | null;
  category: string | null;
  occurrenceDate: string;
  prepStartDate: string;
  timeOfDay: string | null;
  status: 'OPEN' | 'COMPLETED' | 'DISMISSED';
  isInPrepWindow: boolean;
  isOverdue: boolean;
  daysUntilOccurrence: number;
  linkedTemplate: { id: number; name: string } | null;
  canStartRun: boolean;
}

export interface FindAllFilters {
  active?: boolean;
  linkedTemplateId?: number;
  category?: string;
}

@Injectable()
export class RemindersService {
  constructor(
    @InjectRepository(ReminderDefinition)
    private readonly reminderRepo: Repository<ReminderDefinition>,
    @InjectRepository(ReminderOccurrenceState)
    private readonly stateRepo: Repository<ReminderOccurrenceState>,
    @InjectRepository(Template)
    private readonly templateRepo: Repository<Template>,
  ) {}

  private get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async findAll(filters: FindAllFilters = {}): Promise<ReminderListItem[]> {
    const qb = this.reminderRepo.createQueryBuilder('r');

    if (filters.active !== undefined) {
      qb.andWhere('r.active = :active', { active: filters.active });
    }
    if (filters.linkedTemplateId !== undefined) {
      qb.andWhere('r.linked_template_id = :linkedTemplateId', {
        linkedTemplateId: filters.linkedTemplateId,
      });
    }
    if (filters.category !== undefined) {
      qb.andWhere('r.category = :category', { category: filters.category });
    }

    const definitions = await qb.getMany();

    // Batch load last completed occurrence dates in a single query
    const ids = definitions.map((d) => d.id);
    const lastCompletedMap = new Map<number, string>();

    if (ids.length > 0) {
      const rows = await this.stateRepo
        .createQueryBuilder('s')
        .select('s.reminder_id', 'reminderId')
        .addSelect('MAX(s.occurrence_date)', 'lastCompleted')
        .where('s.reminder_id IN (:...ids)', { ids })
        .andWhere("s.status = 'COMPLETED'")
        .groupBy('s.reminder_id')
        .getRawMany<{ reminderId: number; lastCompleted: string }>();

      for (const row of rows) {
        lastCompletedMap.set(Number(row.reminderId), row.lastCompleted);
      }
    }

    const today = this.today;
    const windowEnd = this.addDays(today, 90);

    return definitions.map((def): ReminderListItem => {
      const upcoming = computeOccurrences(def, today, windowEnd);
      const nextOccurrenceDate = upcoming[0] ?? null;
      const nextPrepStartDate = nextOccurrenceDate
        ? prepStartDate(nextOccurrenceDate, def.leadTimeDays)
        : null;

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        cadence: def.cadence,
        interval: def.interval,
        anchorDate: def.anchorDate,
        weekdays: def.weekdays,
        timeOfDay: def.timeOfDay,
        leadTimeDays: def.leadTimeDays,
        linkedTemplateId: def.linkedTemplateId,
        active: def.active,
        nextOccurrenceDate,
        nextPrepStartDate,
        lastCompletedOccurrenceDate: lastCompletedMap.get(def.id) ?? null,
        createdAt: def.createdAt,
        updatedAt: def.updatedAt,
      };
    });
  }

  async findOne(id: number): Promise<ReminderListItem> {
    const def = await this.reminderRepo.findOne({ where: { id } });
    if (!def) {
      throw new NotFoundException(`Reminder with id ${id} not found`);
    }

    const today = this.today;
    const windowEnd = this.addDays(today, 90);
    const upcoming = computeOccurrences(def, today, windowEnd);
    const nextOccurrenceDate = upcoming[0] ?? null;
    const nextPrepStartDate = nextOccurrenceDate
      ? prepStartDate(nextOccurrenceDate, def.leadTimeDays)
      : null;

    const lastState = await this.stateRepo
      .createQueryBuilder('s')
      .select('MAX(s.occurrence_date)', 'lastCompleted')
      .where('s.reminder_id = :id', { id })
      .andWhere("s.status = 'COMPLETED'")
      .getRawOne<{ lastCompleted: string | null }>();

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      category: def.category,
      cadence: def.cadence,
      interval: def.interval,
      anchorDate: def.anchorDate,
      weekdays: def.weekdays,
      timeOfDay: def.timeOfDay,
      leadTimeDays: def.leadTimeDays,
      linkedTemplateId: def.linkedTemplateId,
      active: def.active,
      nextOccurrenceDate,
      nextPrepStartDate,
      lastCompletedOccurrenceDate: lastState?.lastCompleted ?? null,
      createdAt: def.createdAt,
      updatedAt: def.updatedAt,
    };
  }

  async create(dto: CreateReminderDto): Promise<ReminderListItem> {
    if (dto.linkedTemplateId != null) {
      const exists = await this.templateRepo.existsBy({
        id: dto.linkedTemplateId,
      });
      if (!exists) {
        throw new BadRequestException(
          `Template with id ${dto.linkedTemplateId} does not exist`,
        );
      }
    }

    const def = this.reminderRepo.create({
      title: dto.title,
      description: dto.description ?? null,
      category: dto.category ?? null,
      cadence: dto.cadence,
      interval: dto.interval ?? 1,
      anchorDate: dto.anchorDate,
      weekdays: dto.weekdays ?? null,
      timeOfDay: dto.timeOfDay ?? null,
      leadTimeDays: dto.leadTimeDays ?? 0,
      linkedTemplateId: dto.linkedTemplateId ?? null,
      active: true,
    });

    const saved = await this.reminderRepo.save(def);
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateReminderDto): Promise<ReminderListItem> {
    const def = await this.reminderRepo.findOne({ where: { id } });
    if (!def) {
      throw new NotFoundException(`Reminder with id ${id} not found`);
    }

    if (
      dto.linkedTemplateId !== undefined &&
      dto.linkedTemplateId !== def.linkedTemplateId
    ) {
      if (dto.linkedTemplateId != null) {
        const exists = await this.templateRepo.existsBy({
          id: dto.linkedTemplateId,
        });
        if (!exists) {
          throw new BadRequestException(
            `Template with id ${dto.linkedTemplateId} does not exist`,
          );
        }
      }
    }

    const fields: Partial<ReminderDefinition> = {};
    if (dto.title !== undefined) fields.title = dto.title;
    if (dto.description !== undefined) fields.description = dto.description ?? null;
    if (dto.category !== undefined) fields.category = dto.category ?? null;
    if (dto.cadence !== undefined) fields.cadence = dto.cadence;
    if (dto.interval !== undefined) fields.interval = dto.interval;
    if (dto.anchorDate !== undefined) fields.anchorDate = dto.anchorDate;
    if (dto.weekdays !== undefined) fields.weekdays = dto.weekdays ?? null;
    if (dto.timeOfDay !== undefined) fields.timeOfDay = dto.timeOfDay ?? null;
    if (dto.leadTimeDays !== undefined) fields.leadTimeDays = dto.leadTimeDays;
    if (dto.linkedTemplateId !== undefined)
      fields.linkedTemplateId = dto.linkedTemplateId ?? null;
    if (dto.active !== undefined) fields.active = dto.active;

    Object.assign(def, fields);
    await this.reminderRepo.save(def);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const def = await this.reminderRepo.findOne({ where: { id } });
    if (!def) {
      throw new NotFoundException(`Reminder with id ${id} not found`);
    }
    await this.reminderRepo.remove(def);
  }

  async getAgenda(from: string, to: string): Promise<ReminderAgendaItem[]> {
    const definitions = await this.reminderRepo.find({
      where: { active: true },
    });

    if (definitions.length === 0) return [];

    // Build all occurrence projections
    const occurrences: Array<{ def: ReminderDefinition; date: string }> = [];
    for (const def of definitions) {
      for (const date of computeOccurrences(def, from, to)) {
        occurrences.push({ def, date });
      }
    }

    if (occurrences.length === 0) return [];

    // Batch load occurrence states for all reminders in window
    const reminderIds = definitions.map((d) => d.id);
    const stateRows = await this.stateRepo.find({
      where: {
        reminderId: In(reminderIds),
        occurrenceDate: Between(from, to),
      },
    });

    const stateMap = new Map<string, ReminderOccurrenceState>();
    for (const row of stateRows) {
      stateMap.set(`${row.reminderId}-${row.occurrenceDate}`, row);
    }

    // Load template names for linked templates
    const templateIds = [
      ...new Set(
        definitions
          .map((d) => d.linkedTemplateId)
          .filter((id): id is number => id != null),
      ),
    ];
    const templateMap = new Map<number, string>();
    if (templateIds.length > 0) {
      const templates = await this.templateRepo.findByIds(templateIds);
      for (const t of templates) {
        templateMap.set(t.id, t.name);
      }
    }

    const today = this.today;

    const items: ReminderAgendaItem[] = occurrences.map(({ def, date }) => {
      const stateKey = `${def.id}-${date}`;
      const state = stateMap.get(stateKey);
      const status: 'OPEN' | 'COMPLETED' | 'DISMISSED' = state
        ? (state.status as 'COMPLETED' | 'DISMISSED')
        : 'OPEN';

      const prep = prepStartDate(date, def.leadTimeDays);
      const derived = computeDerivedFields(date, def.leadTimeDays, today);

      const linkedTemplate =
        def.linkedTemplateId != null
          ? {
              id: def.linkedTemplateId,
              name: templateMap.get(def.linkedTemplateId) ?? '',
            }
          : null;

      return {
        reminderId: def.id,
        title: def.title,
        description: def.description,
        category: def.category,
        occurrenceDate: date,
        prepStartDate: prep,
        timeOfDay: def.timeOfDay,
        status,
        isInPrepWindow: derived.isInPrepWindow,
        isOverdue: derived.isOverdue,
        daysUntilOccurrence: derived.daysUntilOccurrence,
        linkedTemplate,
        canStartRun: def.linkedTemplateId != null,
      };
    });

    return items.sort((a, b) =>
      a.occurrenceDate.localeCompare(b.occurrenceDate),
    );
  }

  async updateOccurrenceState(
    id: number,
    occurrenceDate: string,
    dto: UpdateReminderOccurrenceDto,
  ): Promise<{
    reminderId: number;
    occurrenceDate: string;
    status: 'OPEN' | 'COMPLETED' | 'DISMISSED';
    actedAt?: Date;
  }> {
    const def = await this.reminderRepo.findOne({ where: { id } });
    if (!def) {
      throw new NotFoundException(`Reminder with id ${id} not found`);
    }

    // Validate that occurrenceDate is a valid occurrence
    const validDates = computeOccurrences(def, occurrenceDate, occurrenceDate);
    if (validDates.length === 0) {
      throw new BadRequestException(
        `${occurrenceDate} is not a valid occurrence date for reminder ${id}`,
      );
    }

    if (dto.status === 'OPEN') {
      // Delete any existing state row, restoring to OPEN
      await this.stateRepo.delete({
        reminderId: id,
        occurrenceDate,
      });
      return { reminderId: id, occurrenceDate, status: 'OPEN' };
    }

    // Upsert state row
    const existing = await this.stateRepo.findOne({
      where: { reminderId: id, occurrenceDate },
    });

    if (existing) {
      existing.status = dto.status as ReminderOccurrenceStatus;
      const saved = await this.stateRepo.save(existing);
      return {
        reminderId: id,
        occurrenceDate,
        status: saved.status as 'COMPLETED' | 'DISMISSED',
        actedAt: saved.actedAt,
      };
    }

    const state = this.stateRepo.create({
      reminderId: id,
      occurrenceDate,
      status: dto.status as ReminderOccurrenceStatus,
    });
    const saved = await this.stateRepo.save(state);
    return {
      reminderId: id,
      occurrenceDate,
      status: saved.status as 'COMPLETED' | 'DISMISSED',
      actedAt: saved.actedAt,
    };
  }

  private addDays(date: string, days: number): string {
    const ms = new Date(`${date}T00:00:00Z`).getTime() + days * 86_400_000;
    return new Date(ms).toISOString().slice(0, 10);
  }
}
