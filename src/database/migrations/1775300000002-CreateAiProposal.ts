import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateAiProposal1775300000002 implements MigrationInterface {
  name = 'CreateAiProposal1775300000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "ai_proposal" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "session_id" integer NOT NULL,
        "target_type" text NOT NULL,
        "target_id" integer NOT NULL,
        "proposal_type" text NOT NULL,
        "field_name" text NOT NULL,
        "current_value" text NOT NULL,
        "proposed_value" text NOT NULL,
        "rationale" text,
        "status" text NOT NULL DEFAULT ('PENDING'),
        "confidence" real,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "applied_at" datetime,
        "reverted_at" datetime,
        CONSTRAINT "FK_ai_proposal_session_id" FOREIGN KEY ("session_id") REFERENCES "ai_session" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "ai_proposal"`);
  }
}
