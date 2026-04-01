import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReminderOccurrenceState1775000000001
  implements MigrationInterface
{
  name = 'CreateReminderOccurrenceState1775000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reminder_occurrence_state" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "reminder_id" integer NOT NULL,
        "occurrence_date" text NOT NULL,
        "status" text NOT NULL,
        "acted_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_reminder_occurrence_state_reminder"
          FOREIGN KEY ("reminder_id") REFERENCES "reminder_definition" ("id")
          ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_reminder_occurrence_state_reminder_date"
          UNIQUE ("reminder_id", "occurrence_date")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_occurrence_state_reminder_date" ON "reminder_occurrence_state" ("reminder_id", "occurrence_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_reminder_occurrence_state_reminder_date"`,
    );
    await queryRunner.query(`DROP TABLE "reminder_occurrence_state"`);
  }
}
