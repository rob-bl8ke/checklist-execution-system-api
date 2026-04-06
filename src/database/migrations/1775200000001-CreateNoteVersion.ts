import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNoteVersion1775200000001 implements MigrationInterface {
  name = 'CreateNoteVersion1775200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "note_version" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "note_id" integer NOT NULL,
        "title" text NOT NULL,
        "body" text,
        "version_number" integer NOT NULL,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "UQ_note_version_note_id_version_number" UNIQUE ("note_id", "version_number"),
        CONSTRAINT "FK_note_version_note_id" FOREIGN KEY ("note_id") REFERENCES "note" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "note_version"`);
  }
}
