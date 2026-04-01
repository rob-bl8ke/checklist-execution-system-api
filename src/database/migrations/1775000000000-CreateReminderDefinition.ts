import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateReminderDefinition1775000000000
  implements MigrationInterface
{
  name = 'CreateReminderDefinition1775000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "reminder_definition" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" text NOT NULL,
        "description" text,
        "category" text,
        "cadence" text NOT NULL,
        "interval" integer NOT NULL DEFAULT (1),
        "anchor_date" text NOT NULL,
        "weekdays" text,
        "time_of_day" text,
        "lead_time_days" integer NOT NULL DEFAULT (0),
        "linked_template_id" integer,
        "active" boolean NOT NULL DEFAULT (1),
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime DEFAULT (datetime('now')),
        CONSTRAINT "FK_reminder_definition_template"
          FOREIGN KEY ("linked_template_id") REFERENCES "template" ("id")
          ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_definition_active" ON "reminder_definition" ("active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_reminder_definition_linked_template_id" ON "reminder_definition" ("linked_template_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "IDX_reminder_definition_linked_template_id"`,
    );
    await queryRunner.query(`DROP INDEX "IDX_reminder_definition_active"`);
    await queryRunner.query(`DROP TABLE "reminder_definition"`);
  }
}
