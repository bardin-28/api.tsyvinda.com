import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { config } from '../shared/app.config';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: config.db.url,
  synchronize: config.isDev,
  logging: config.isDev,
  entities: [__dirname + '/../modules/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
});
