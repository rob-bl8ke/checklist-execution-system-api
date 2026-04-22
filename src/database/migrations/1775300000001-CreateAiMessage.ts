import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiMessage1775300000001 implements MigrationInterface {
  name = 'CreateAiMessage1775300000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_message" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "session_id" integer NOT NULL,
        "role" text NOT NULL,
        "content" text NOT NULL,
        "preset_action_key" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_ai_message_session_id" FOREIGN KEY ("session_id") REFERENCES "ai_session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_message"`);
  }
}
