import { DataSource } from 'typeorm';

const isCompiled = __filename.endsWith('.js');

export const AppDataSource = new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'checklist.db',
  entities: isCompiled
    ? [`${__dirname}/../**/*.entity.js`]
    : ['src/**/*.entity.ts'],
  migrations: isCompiled
    ? [`${__dirname}/migrations/*.js`]
    : ['src/database/migrations/*.ts'],
  synchronize: false,
});
