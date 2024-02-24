import {combinations, db, elements, sqlite} from "./db";
import {count, eq} from "drizzle-orm";
import {z} from "zod";
import fs from "node:fs";

const args = process.argv.slice(2);

let globalOffset = 0;
const limit = parseInt(process.env.LIMIT || "100");
const mode = z.enum([
  'depth',
  'random',
  'alphabetical',
  'specific',
]).parse(process.env.MODE);
const delay = parseInt(process.env.DELAY || "500");
if (isNaN(limit))
  throw new Error("invalid limit");
if (isNaN(delay))
  throw new Error("invalid delay");
if(mode === 'specific' && args.length !== 1)
  throw new Error("specify one element to combine with");

const elementsMap = (await db.select().from(elements)).reduce((acc, e) => {
  acc.set(e.id, e);
  return acc;
}, new Map());
const knownElements = new Set(elementsMap.keys());
let [{count: checked}] = await db.select({
  count: count()
}).from(combinations);

type combination = {
  first: string,
  second: string,
}

async function getCombinations() {
  // using small random sample to allow random
  // combinations without joining all elements

  return await sqlite.query(`
    with small_selection as (
      select * from elements
          ${mode === 'specific' ? `WHERE id = '${args[0]}'` : ""}
          ${mode === 'random' ? 'ORDER BY RANDOM() limit 100' : ""}
    ), small_selection_2 as (
        select * from elements ${mode === 'random' ? 'ORDER BY RANDOM() limit 100' : ""}
    )
    select el1.id as first, el2.id as second, el1.depth + el2.depth as sum_depth 
    from small_selection as el1
             cross join small_selection_2 as el2
             LEFT JOIN combinations ON el1.id = combinations.firstElement AND combinations.secondElement = el2.id
    WHERE combinations.firstElement IS NULL
    ${
      mode === 'depth' ? "ORDER BY el1.depth, el2.depth" : ""
    }
    ${
      mode === 'alphabetical' ? "ORDER BY sum_depth" : ""
    }
    limit $limit;
`).all({$limit: mode === 'specific' ? knownElements.size : limit}) as combination[];
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
      "Referrer-Policy": "strict-origin-when-cross-origin"
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

while (true) {
  for (const combination of currentCombinations) {
    await wait(delay);
    const firstElement = elementsMap.get(combination.first);
    const secondElement = elementsMap.get(combination.second);
    const result = await checkCombination(combination);

    let emoji = result.emoji === undefined ? "" : ` ${result.emoji}`;
    if (result.isNew) {
      console.log(`new element found ${combination.first} + ${combination.second} = ${result.result}${emoji}`);
      fs.appendFileSync("new_elements.txt", `${combination.first} + ${combination.second} = ${result.result}${emoji}\n`);
    } else {
      console.log(`combination ${combination.first} + ${combination.second} = ${result.result}${emoji}`);
    }

    await db.insert(combinations).values({
      firstElement: combination.first,
      secondElement: combination.second,
      result: result.result,
    });
    checked++;

    const combinationDepth = firstElement.depth > secondElement.depth ? firstElement.depth + 1 : secondElement.depth + 1;


    if (knownElements.has(result.result)) {
      if(combinationDepth < elementsMap.get(result.result).depth) {
        elementsMap.get(result.result).depth = combinationDepth;
        await db.update(elements)
          .set({depth: combinationDepth})
          .where(eq(elements.id, result.result));
      }
      continue;
    }


    const newElement = {
      id: result.result,
      emoji: result.emoji,
      depth: combinationDepth
    };

    await db.insert(elements).values(newElement);
    knownElements.add(result.result);
    elementsMap.set(result.result, newElement);
  }

  currentCombinations = await getCombinations();


  console.log(`current elements: ${knownElements.size}`);
  console.log(`current combinations: ${checked}`);

  if (checked === knownElements.size ** 2) {
    console.log("all combinations checked");
    break;
  }
}
