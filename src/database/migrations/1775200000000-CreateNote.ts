import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNote1775200000000 implements MigrationInterface {
  name = 'CreateNote1775200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "note" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" text NOT NULL,
        "body" text,
        "variable_prefix" text,
        "variable_suffix" text,
        "ai_enabled" boolean NOT NULL DEFAULT (0),
        "ai_provider_key" text,
        "ai_model" text,
        "ai_prompt" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime DEFAULT (datetime('now'))
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "note"`);
  }
}
