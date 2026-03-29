import { AppDataSource } from './database/data-source';

AppDataSource.initialize()
  .then((ds) => ds.runMigrations())
  .then(() => {
    console.log('Migrations complete');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Migration failed', err);
    process.exit(1);
  });
