import {combinations, db, elements, sqlite} from "./db";
import {count} from "drizzle-orm";
import {z} from "zod";
import fs from "node:fs";

const limit = parseInt(process.env.LIMIT || "100");
const doSkip = process.env.SKIP === 'true';
const delay = parseInt(process.env.DELAY || "500");
if (isNaN(limit))
  throw new Error("invalid limit");
if (isNaN(delay))
  throw new Error("invalid delay");

const dbElements = await db.select().from(elements);
const knownElements = new Set(dbElements.map(e => e.id));
let [{count: checked}] = await db.select({
  count: count()
}).from(combinations);

type combination = {
  first: string,
  second: string,
}

async function getCombinations() {
  let skip = 0;
  if (doSkip) {
    const total = knownElements.size ** 2;
    const leftToCheck = total - checked;

    skip = Math.floor(Math.random() * leftToCheck);
  }

  return await sqlite.query(`
      select el1.id as first, el2.id as second
      from elements as el1
               cross join elements as el2
               LEFT JOIN combinations ON el1.id = combinations.firstElement AND combinations.secondElement = el2.id
      WHERE combinations.firstElement IS NULL
      limit ${limit} offset ${skip};
  `).all() as combination[];
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkCombination(combination) {
  const response = z.object({
    result: z.string(),
    emoji: z.string().optional(),
    isNew: z.boolean(),
  });

  const req = await fetch(`https://neal.fun/api/infinite-craft/pair?first=${combination.first}&second=${combination.second}`, {
    "headers": {
      "accept": "*/*",
      "accept-language": "en-US,en;q=0.9",
      "Referer": "https://neal.fun/infinite-craft/",
    },
    "body": null,
    "method": "GET"
  });

  const text = await req.text();
  try {
    const json = JSON.parse(text);
    return response.parse(json);
  } catch (e) {
    console.error(text);
    throw e;
  }
}

let currentCombinations = await getCombinations();

while (currentCombinations.length > 0) {
  for (const combination of currentCombinations) {
    await wait(delay);
    const result = await checkCombination(combination);
    if (result.isNew) {
      console.log(`new element found ${combination.first} + ${combination.second} = ${result.result} ${result.emoji}`);
      fs.appendFileSync("new_elements.txt", `${combination.first} + ${combination.second} = ${result.result} ${result.emoji}\n`);
    } else {
      console.log(`combination ${combination.first} + ${combination.second} = ${result.result} ${result.emoji}`);
    }

    await db.insert(combinations).values({
      firstElement: combination.first,
      secondElement: combination.second,
      result: result.result,
    });
    checked++;

    if (knownElements.has(result.result))
      continue;

    await db.insert(elements).values({
      id: result.result,
      emoji: result.emoji,
    });

    knownElements.add(result.result);
  }

  currentCombinations = await getCombinations();


  console.log(`current elements: ${knownElements.size}`);
  console.log(`current combinations: ${checked}`);
}
