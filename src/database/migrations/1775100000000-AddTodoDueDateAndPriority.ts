import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTodoDueDateAndPriority1775100000000
  implements MigrationInterface
{
  name = 'AddTodoDueDateAndPriority1775100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "todo" ADD COLUMN "due_date" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "todo" ADD COLUMN "priority" text NOT NULL DEFAULT 'NORMAL'`,
    );
    await queryRunner.query(
      `UPDATE "todo" SET "priority" = 'NORMAL' WHERE "priority" IS NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite does not support DROP COLUMN directly; recreate table without the new columns
    await queryRunner.query(
      `CREATE TABLE "todo_backup" AS SELECT "id", "title", "description", "completed", "created_at", "completed_at" FROM "todo"`,
    );
    await queryRunner.query(`DROP TABLE "todo"`);
    await queryRunner.query(
      `ALTER TABLE "todo_backup" RENAME TO "todo"`,
    );
  }
}
