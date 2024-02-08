import { drizzle } from 'drizzle-orm/bun-sqlite';
// @ts-ignore
import { Database } from 'bun:sqlite';
import {primaryKey, sqliteTable, text} from "drizzle-orm/sqlite-core";



export const sqlite = new Database('sqlite.db');
export const db = drizzle(sqlite);


export const elements = sqliteTable('elements', {
  id: text('id').primaryKey(),
  emoji: text('emoji'),
});

export const combinations = sqliteTable('combinations', {
  firstElement: text('firstElement').primaryKey(),
  secondElement: text('secondElement').primaryKey(),

  result: text('result'),
}, (t) => ({
  first_second_pk: primaryKey({
    name: "first_second_pk",
    columns: [t.firstElement, t.secondElement],
  }),
}));
