import {combinations, db, elements} from "./db";
import {sql} from "drizzle-orm";

db.run(sql`
    CREATE TABLE IF NOT EXISTS elements
    (
        id    TEXT PRIMARY KEY,
        emoji TEXT
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
  {id: "Fire", emoji: "🔥"},
  {id: "Water", emoji: "💧"},
  {id: "Earth", emoji: "🌍"},
  {id: "Wind", emoji: "🌬️"},
]).execute();
