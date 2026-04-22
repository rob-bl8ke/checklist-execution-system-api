import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiSession1775300000000 implements MigrationInterface {
  name = 'CreateAiSession1775300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_session" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "target_type" text NOT NULL,
        "target_id" integer NOT NULL,
        "provider_key" text NOT NULL,
        "model" text,
        "system_prompt_snapshot" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime DEFAULT (datetime('now')),
        "cleared_at" datetime
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_session"`);
  }
}
