import { PrimaryColumn } from 'typeorm';

/**
 * Primary key filled by Postgres 18's `uuidv7()` (time-ordered UUID v7). Use this instead of
 * `@PrimaryGeneratedColumn('uuid')`, whose default is a random v4. TypeORM returns the
 * generated value on insert (columns with a default are part of `RETURNING`).
 */
export const PrimaryUuidV7Column = (): PropertyDecorator =>
  PrimaryColumn({ type: 'uuid', default: () => 'uuidv7()' });
