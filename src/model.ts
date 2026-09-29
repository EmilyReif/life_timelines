// Data model + pure helpers. The visualization depends only on this file,
// so a future Wikidata/Wikipedia loader just needs to produce Person[].

export const EVENT_TYPES = ["child", "marriage", "divorce", "career", "education", "other", "death"] as const;

export type EventType = (typeof EVENT_TYPES)[number];

/**
 * `lane` is the horizontal slot relative to the lifeline (0), in lane widths.
 * Left, outer → inner: children + other, then relationships. Right: career + education.
 * Death sits on the lifeline itself.
 */
// Palette sampled from the book cover: mustard, bottle green, teal, orange on cream.
export const PAGE_BG = "#ece6dc"; // keep in sync with --bg in styles.css
export const TYPE_META: Record<EventType, { color: string; lane: number; hollow?: boolean }> = {
  child: { color: "#c9a227", lane: -2 }, // mustard
  other: { color: "#a39b8d", lane: -2 }, // warm taupe
  marriage: { color: "#e0552b", lane: -1 }, // orange
  divorce: { color: "#e0552b", lane: -1, hollow: true },
  career: { color: "#157a80", lane: 1 }, // teal; jobs, major works, awards
  education: { color: "#2f6e57", lane: 1 }, // bottle green
  death: { color: "#b5ad9f", lane: 0 }, // same warm gray as the lifeline + birth dot
};

/**
 * Legend entries, in the same left-to-right order as the lanes.
 * Marriage + divorce share one entry (same color; divorce is hollow).
 * Death has no entry; its dot always stays visible where the lifeline ends.
 */
export const LEGEND_GROUPS: { id: string; label: string; types: EventType[] }[] = [
  { id: "child", label: "Children", types: ["child"] },
  { id: "other", label: "Other", types: ["other"] },
  { id: "relationship", label: "Relationships", types: ["marriage", "divorce"] },
  { id: "education", label: "Education", types: ["education"] },
  { id: "career", label: "Career", types: ["career"] },
];

/** Dates are ISO-ish strings: "YYYY", "YYYY-MM" or "YYYY-MM-DD". */
export type LifeEvent = {
  date: string;
  endDate?: string;
  type: EventType;
  title: string;
  description?: string; // not shown in the UI yet
};

export type Person = {
  id: string;
  name: string;
  firstName: string;
  shortName: string; // usually the surname
  birthDate: string;
  deathDate?: string;
  /** Short phrase used as the death event's title, e.g. "Dies of tuberculosis". */
  deathCause?: string;
  wikipediaUrl?: string; // provenance; not shown in the UI yet
  events: LifeEvent[];
};

/** An event resolved against its person, with ages computed. */
export type PlacedEvent = {
  key: string;
  event: LifeEvent;
  age: number;
  endAge?: number;
};

const DATE_RE = /^(\d{1,4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

function parseDate(s: string): { year: number; month?: number; day?: number } | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  return {
    year: Number(m[1]),
    month: m[2] ? Number(m[2]) : undefined,
    day: m[3] ? Number(m[3]) : undefined,
  };
}

function utc(y: number, monthIdx: number, day: number): number {
  const d = new Date(0);
  d.setUTCFullYear(y, monthIdx, day); // avoids Date.UTC's 0–99 → 1900s quirk
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

/** Date string → fractional year. Imprecise dates land mid-period. */
function toFractionalYear(s: string): number {
  const p = parseDate(s);
  if (!p) return NaN;
  const { year } = p;
  if (p.month === undefined) return year + 0.5;
  if (p.day === undefined) return year + (p.month - 0.5) / 12;
  const start = utc(year, 0, 1);
  const end = utc(year + 1, 0, 1);
  return year + (utc(year, p.month - 1, p.day) - start) / (end - start);
}

function ageAt(person: Person, date: string): number {
  return toFractionalYear(date) - toFractionalYear(person.birthDate);
}

/** Age at death, or current age if living. */
export function lifespan(person: Person): number {
  return ageAt(person, person.deathDate ?? new Date().toISOString().slice(0, 10));
}

/** "Age 27" means the year from the 27th birthday up to the 28th. */
export function wholeAge(age: number): number {
  return Math.floor(age + 1e-9);
}

export function placeEvents(person: Person): PlacedEvent[] {
  // The person's own death is derived from deathDate rather than stored as an event.
  const events: LifeEvent[] = person.deathDate
    ? [...person.events, { date: person.deathDate, type: "death", title: person.deathCause ?? "Dies" }]
    : person.events;
  return events
    .map((event, i) => ({
      key: `${person.id}:${i}`,
      event,
      age: ageAt(person, event.date),
      endAge: event.endDate ? ageAt(person, event.endDate) : undefined,
    }))
    .filter((p) => Number.isFinite(p.age))
    .sort((a, b) => a.age - b.age);
}

export function yearOf(s: string): string {
  return String(parseDate(s)?.year ?? "");
}
