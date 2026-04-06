import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateNoteTag1775200000002 implements MigrationInterface {
  name = 'CreateNoteTag1775200000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "note_tag" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "note_id" integer NOT NULL,
        "tag" text NOT NULL,
        CONSTRAINT "UQ_note_tag_note_id_tag" UNIQUE ("note_id", "tag"),
        CONSTRAINT "FK_note_tag_note_id" FOREIGN KEY ("note_id") REFERENCES "note" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_note_tag_tag" ON "note_tag" ("tag")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_note_tag_tag"`);
    await queryRunner.query(`DROP TABLE "note_tag"`);
  }
}
