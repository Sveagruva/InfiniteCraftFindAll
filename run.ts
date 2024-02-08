import {combinations, db, elements, sqlite} from "./db";
import {count, sql} from "drizzle-orm";
import {z} from "zod";


const dbElements = await db.select().from(elements);
const knownElements = new Set(dbElements.map(e => e.id));

type combination = {
  first: string,
  second: string,
}

async function getCombinations() {
  const combinations = await sqlite.query(`
      select el1.id as first, el2.id as second from elements as el1
                                     cross join elements as el2
                                     LEFT JOIN combinations ON el1.id = combinations.firstElement AND combinations.secondElement = el2.id
      WHERE combinations.firstElement IS NULL limit 500;
  `).all();

  return combinations as combination[];
}

const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function checkCombination(combination) {
  const response = z.object({
    result: z.string(),
    emoji: z.string(),
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

while(currentCombinations.length > 0) {
  for (const combination of currentCombinations) {
    await wait(500);
    const result = await checkCombination(combination);
    if(result.isNew) {
      console.log(`new element found (${combination.first} + ${combination.second}) = ${result.result} ${result.emoji}`);
    }

    await db.insert(combinations).values({
      firstElement: combination.first,
      secondElement: combination.second,
      result: result.result,
    });

    if(knownElements.has(result.result))
      continue;

    await db.insert(elements).values({
      id: result.result,
      emoji: result.emoji,
    });

    knownElements.add(result.result);
  }



  const [{count: combsCount}] = await db.select({
    count: count()
  }).from(combinations);
  console.log(`current elements: ${knownElements.size}`);
  console.log(`current combinations: ${combsCount}`);
  currentCombinations = await getCombinations();
}
