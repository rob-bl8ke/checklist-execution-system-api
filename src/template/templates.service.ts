import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './template.entity';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

export interface TemplateListItem {
  id: number;
  name: string;
  stepCount: number;
}

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly repo: Repository<Template>,
  ) {}

  async findAll(): Promise<TemplateListItem[]> {
    const rows = await this.repo
      .createQueryBuilder('t')
      .leftJoin('t.steps', 's')
      .select('t.id', 'id')
      .addSelect('t.name', 'name')
      .addSelect('COUNT(s.id)', 'stepCount')
      .groupBy('t.id')
      .getRawMany<{ id: string; name: string; stepCount: string }>();

    return rows.map((r) => ({
      id: Number(r.id),
      name: r.name,
      stepCount: Number(r.stepCount),
    }));
  }

  async findOne(id: number): Promise<Template> {
    const template = await this.repo.findOne({
      where: { id },
      relations: { steps: true },
      order: { steps: { position: 'ASC' } },
    });
    if (!template) {
      throw new NotFoundException(`Template with id ${id} not found`);
    }
    return template;
  }

  async create(dto: CreateTemplateDto): Promise<Template> {
    const template = this.repo.create(dto);
    return this.repo.save(template);
  }

  async update(id: number, dto: UpdateTemplateDto): Promise<Template> {
    const template = await this.findOne(id);
    const patch = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined),
    );
    Object.assign(template, patch);
    return this.repo.save(template);
  }

  async remove(id: number): Promise<void> {
    const template = await this.findOne(id);
    await this.repo.remove(template);
  }
}
