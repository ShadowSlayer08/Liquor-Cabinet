// Real Livcheers data for the Fill my bar tests: the Gurgaon category pages saved on 09 Oct 2026
// (13 categories, 1,871 bottles), parsed with src/lib/parse/livcheers.js and stored as compact rows
// (gurgaon.json: `fields`, with brand/sub/origin/priceCategory as indexes into `dict`). This expands
// them back to the app's item shape — the fields the optimiser and the sheet read.
import { readFileSync } from "node:fs";
import { prettyVol } from "../../../src/lib/parse/livcheers.js";

const raw = JSON.parse(readFileSync(new URL("./gurgaon.json", import.meta.url), "utf8"));

// { [catId]: items[] }. `withRank: false` gives what a phone has cached from before ranks were parsed.
export function loadCatalog({ withRank = true, cats = null } = {}) {
  const out = {};
  for (const [cat, rows] of Object.entries(raw.cats)) {
    if (cats && !cats.includes(cat)) continue;
    out[cat] = rows.map(([id, name, brand, sub, ml, price, rating, rank, origin, pc]) => {
      const [originName, flag] = raw.dict.origin[origin];
      const item = { id, name, brand: raw.dict.brand[brand], sub: raw.dict.sub[sub], vol: prettyVol(`${ml}ML`), ml, price, rating,
        origin: originName, flag, priceCategory: raw.dict.priceCategory[pc] };
      if (withRank) item.rank = rank || null;
      return item;
    });
  }
  return out;
}

export const CITY = raw.city;
