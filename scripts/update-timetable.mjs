// scripts/update-timetable.mjs
//
// Fetches whatever day HRR is currently showing on
// https://www.hrr.co.uk/compete/race-timetable/ and writes it into
// data/schedule.json under the matching weekday key.
//
// This is intentionally simple (Node's built-in fetch + a small HTML table
// parser via regex, no npm dependencies) so it has as few moving parts as
// possible to break. If HRR redesigns their site's HTML, this may need
// updating — the parsing logic is isolated in parseTimetableHTML() below.

import { readFile, writeFile } from "node:fs/promises";

const SCHEDULE_PATH = new URL("../data/schedule.json", import.meta.url);
const TIMETABLE_URL = "https://www.hrr.co.uk/compete/race-timetable/";

const WEEKDAYS = ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];

async function main(){
  console.log(`Fetching ${TIMETABLE_URL} ...`);
  const res = await fetch(TIMETABLE_URL, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; hrr-timetable-bot/1.0)" }
  });
  if(!res.ok){
    throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const day = detectDay(html);
  if(!day){
    console.log("Could not detect which day is currently shown — no changes made.");
    return;
  }
  console.log(`HRR is currently showing: ${day}`);

  const { label, races } = parseTimetableHTML(html);
  if(races.length === 0){
    console.log("No races parsed — leaving schedule.json untouched (likely a site structure change, needs a look).");
    return;
  }
  console.log(`Parsed ${races.length} races for ${label}.`);

  const schedule = JSON.parse(await readFile(SCHEDULE_PATH, "utf8"));
  const existing = schedule.days[day];

  if(existing && JSON.stringify(existing.races) === JSON.stringify(races)){
    console.log("No changes since last update.");
    return;
  }

  schedule.days[day] = { label, races };
  schedule.lastUpdated = new Date().toISOString();

  await writeFile(SCHEDULE_PATH, JSON.stringify(schedule, null, 2) + "\n", "utf8");
  console.log(`Updated data/schedule.json for ${day}.`);

  // Signal to the workflow whether anything changed, for the PR step.
  console.log(`::set-output name=changed::true`);
  console.log(`::set-output name=day::${day}`);
}

function detectDay(html){
  // Looks for a visible date heading like "Wednesday 01 July 2026"
  const match = html.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+\w+\s+2026/i);
  if(!match) return null;
  const word = match[1].toLowerCase();
  return WEEKDAYS.includes(word) ? word : null;
}

function parseTimetableHTML(html){
  // Grab the visible date label for the tab's display title.
  const labelMatch = html.match(/((Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+\d{1,2}\s+\w+\s+2026)/i);
  const label = labelMatch ? labelMatch[1] : "Unknown day";

  // Find the timetable <table>...</table> block. HRR's site renders one
  // main data table on this page.
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if(!tableMatch) return { label, races: [] };
  const tableHTML = tableMatch[0];

  const rows = [...tableHTML.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(m => m[0]);
  const races = [];

  for(const rowHTML of rows){
    const cells = [...rowHTML.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map(m => stripTags(m[1]).trim());

    if(cells.length === 0) continue;

    // Interval row: a single meaningful cell containing "interval"
    const nonEmpty = cells.filter(c => c.length > 0);
    if(nonEmpty.length === 1 && /interval/i.test(nonEmpty[0])){
      races.push({ interval: toTitleCase(nonEmpty[0]) });
      continue;
    }

    // Skip header rows and fully blank spacer rows
    if(nonEmpty.length === 0) continue;
    if(!/^\d+$/.test(cells[0])) continue;

    const [numStr, time, comp, berks, bucks] = cells;
    if(!time || !comp || !berks || !bucks) continue;

    races.push({
      n: parseInt(numStr, 10),
      t: normaliseTime(time),
      c: comp,
      berks,
      bucks
    });
  }

  return { label, races };
}

function stripTags(html){
  return html.replace(/<[^>]+>/g, " ").replace(/&#039;/g, "'").replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"').replace(/\s+/g, " ");
}

function toTitleCase(s){
  return s.replace(/\w\S*/g, t => t[0].toUpperCase() + t.slice(1).toLowerCase());
}

function normaliseTime(t){
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if(!m) return t;
  return `${m[1].padStart(2,"0")}:${m[2]}`;
}

main().catch(err=>{
  console.error(err);
  process.exit(1);
});
