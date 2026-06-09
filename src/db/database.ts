import 'dotenv/config';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { config } from '../shared/app.config';

// Single source of TypeORM connection config. Shared by the Nest TypeOrmModule
// (runtime connection) and the AppDataSource below (used only by the
// db:migration:* CLI scripts). Keeping one object prevents the two from drifting.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: config.db.url,
  synchronize: config.isDev,
  logging: config.isDev,
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
};

export const AppDataSource = new DataSource(dataSourceOptions);
