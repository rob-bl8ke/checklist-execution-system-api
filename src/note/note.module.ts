import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Note } from './note.entity';
import { NoteVersion } from './note-version.entity';
import { NoteTag } from './note-tag.entity';
import { NotesController } from './notes.controller';
import { NotesService } from './notes.service';
import { InstanceModule } from '../instance/instance.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Note, NoteVersion, NoteTag]),
    InstanceModule,
  ],
  controllers: [NotesController],
  providers: [NotesService],
  exports: [NotesService],
})
export class NoteModule {}
