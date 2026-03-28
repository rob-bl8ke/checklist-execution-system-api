import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateTodo1774726356563 implements MigrationInterface {
    name = 'CreateTodo1774726356563'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "todo" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "title" text NOT NULL, "description" text, "completed" boolean NOT NULL DEFAULT (0), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "completed_at" datetime)`);
        await queryRunner.query(`CREATE TABLE "template" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "name" text NOT NULL, "description" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "template_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "template_id" integer NOT NULL, "position" real NOT NULL, "title" text NOT NULL, "instructions" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "instance_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "instance_id" integer NOT NULL, "step_order" integer NOT NULL, "title" text NOT NULL, "instructions_template" text, "rendered_instructions" text, "completed" boolean NOT NULL DEFAULT (0), "completed_at" datetime, "notes" text)`);
        await queryRunner.query(`CREATE TABLE "instance" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "template_id" integer NOT NULL, "name" text NOT NULL, "variables" text, "status" text NOT NULL DEFAULT ('IN_PROGRESS'), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "next_step_id" integer)`);
        await queryRunner.query(`CREATE TABLE "temporary_template_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "template_id" integer NOT NULL, "position" real NOT NULL, "title" text NOT NULL, "instructions" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "FK_eb4c493e97cf2c51c3f60f0a863" FOREIGN KEY ("template_id") REFERENCES "template" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_template_step"("id", "template_id", "position", "title", "instructions", "created_at") SELECT "id", "template_id", "position", "title", "instructions", "created_at" FROM "template_step"`);
        await queryRunner.query(`DROP TABLE "template_step"`);
        await queryRunner.query(`ALTER TABLE "temporary_template_step" RENAME TO "template_step"`);
        await queryRunner.query(`CREATE TABLE "temporary_instance_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "instance_id" integer NOT NULL, "step_order" integer NOT NULL, "title" text NOT NULL, "instructions_template" text, "rendered_instructions" text, "completed" boolean NOT NULL DEFAULT (0), "completed_at" datetime, "notes" text, CONSTRAINT "FK_6503b889ec12e2c3b58cec2f755" FOREIGN KEY ("instance_id") REFERENCES "instance" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_instance_step"("id", "instance_id", "step_order", "title", "instructions_template", "rendered_instructions", "completed", "completed_at", "notes") SELECT "id", "instance_id", "step_order", "title", "instructions_template", "rendered_instructions", "completed", "completed_at", "notes" FROM "instance_step"`);
        await queryRunner.query(`DROP TABLE "instance_step"`);
        await queryRunner.query(`ALTER TABLE "temporary_instance_step" RENAME TO "instance_step"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "instance_step" RENAME TO "temporary_instance_step"`);
        await queryRunner.query(`CREATE TABLE "instance_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "instance_id" integer NOT NULL, "step_order" integer NOT NULL, "title" text NOT NULL, "instructions_template" text, "rendered_instructions" text, "completed" boolean NOT NULL DEFAULT (0), "completed_at" datetime, "notes" text)`);
        await queryRunner.query(`INSERT INTO "instance_step"("id", "instance_id", "step_order", "title", "instructions_template", "rendered_instructions", "completed", "completed_at", "notes") SELECT "id", "instance_id", "step_order", "title", "instructions_template", "rendered_instructions", "completed", "completed_at", "notes" FROM "temporary_instance_step"`);
        await queryRunner.query(`DROP TABLE "temporary_instance_step"`);
        await queryRunner.query(`ALTER TABLE "template_step" RENAME TO "temporary_template_step"`);
        await queryRunner.query(`CREATE TABLE "template_step" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "template_id" integer NOT NULL, "position" real NOT NULL, "title" text NOT NULL, "instructions" text, "created_at" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`INSERT INTO "template_step"("id", "template_id", "position", "title", "instructions", "created_at") SELECT "id", "template_id", "position", "title", "instructions", "created_at" FROM "temporary_template_step"`);
        await queryRunner.query(`DROP TABLE "temporary_template_step"`);
        await queryRunner.query(`DROP TABLE "instance"`);
        await queryRunner.query(`DROP TABLE "instance_step"`);
        await queryRunner.query(`DROP TABLE "template_step"`);
        await queryRunner.query(`DROP TABLE "template"`);
        await queryRunner.query(`DROP TABLE "todo"`);
    }

}
