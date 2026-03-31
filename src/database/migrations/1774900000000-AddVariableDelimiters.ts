import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVariableDelimiters1774900000000 implements MigrationInterface {
  name = 'AddVariableDelimiters1774900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "template" ADD COLUMN "variable_prefix" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "template" ADD COLUMN "variable_suffix" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite does not support DROP COLUMN directly; recreate table without the columns
    await queryRunner.query(
      `CREATE TABLE "template_backup" AS SELECT "id", "name", "description", "created_at", "updated_at" FROM "template"`,
    );
    await queryRunner.query(`DROP TABLE "template"`);
    await queryRunner.query(
      `ALTER TABLE "template_backup" RENAME TO "template"`,
    );
  }
}
