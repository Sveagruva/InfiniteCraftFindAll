import {combinations, db, elements} from "./db";
import {sql} from "drizzle-orm";

db.run(sql`
    CREATE TABLE IF NOT EXISTS elements
    (
        id    TEXT PRIMARY KEY,
        emoji TEXT,
        depth INTEGER NOT NULL
    );
`);

db.run(sql`
    CREATE TABLE IF NOT EXISTS combinations
    (
        firstElement  TEXT,
        secondElement TEXT,
        result        TEXT,

        PRIMARY KEY (firstElement, secondElement)
    );
`);

await db.delete(combinations).execute();
await db.delete(elements).execute();

await db.insert(elements).values([
  {id: "Fire", emoji: "🔥", depth: 0},
  {id: "Water", emoji: "💧", depth: 0},
  {id: "Earth", emoji: "🌍", depth: 0},
  {id: "Wind", emoji: "🌬️", depth: 0},
]).execute();
