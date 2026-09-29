# Life Timelines

Compare famous people's lives on an **age-aligned timeline**. Everyone's birth is lined up at age 0, so you can see what different people were doing at the same age

Each person is a vertical column that runs from birth (top) down to death. Events are colored markers by type: personal life sits to the left of the line (children and other on the outside, relationships next to the line; outer dots slide in when nothing is between them and the line), and professional life (education, career) to the right. Move the horizontal age band up and down to compare everyone at a given age.

## Running

Requires **Node.js 20.19+** (or 22.12+).

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5173/.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (localhost only) |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build at http://127.0.0.1:4173/ |

## Deploying

Live at **https://emilyreif.com/life_timelines/**. Every push to `main` builds and publishes to GitHub Pages via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Using it

- **Move the age band:** hover over the chart (on touch, drag), or use ↑/↓ (Shift = 5 years). Events in the band get enlarged and labeled.
- **Event details:** click a marker (or its label in the band) to outline it and show its title and age; Esc or clicking the chart clears it.
- **Focus on one event type:** click an item in the legend to show only that type. Click it again to show everything.

## Project layout

```
src/
  model.ts          # types, event-type colors, date parsing, age computation
  data/people.ts    # hard-coded dataset (~20 people)
  Timeline.tsx      # the chart: columns, markers, age band, labels
  Legend.tsx        # legend / type filter
  App.tsx           # app state
```

The chart depends only on the `Person[]` shape in `model.ts`:

```ts
type Person = {
  id: string;
  name: string;
  firstName: string;
  shortName: string;      // usually the surname
  birthDate: string;      // "YYYY", "YYYY-MM" or "YYYY-MM-DD"
  deathDate?: string;
  deathCause?: string;    // title of the derived death event, e.g. "Dies of tuberculosis"
  wikipediaUrl?: string;  // provenance; not shown yet
  events: LifeEvent[];
};

type LifeEvent = {
  date: string;
  endDate?: string;       // drawn as a bar
  type: "child" | "marriage" | "divorce" | "career"   // career = jobs, works, awards
      | "education" | "other";
  title: string;
  description?: string;   // not shown yet
};
```

To add a person, add an entry to `src/data/people.ts`. Age is computed as `eventDate − birthDate`. Imprecise dates are placed mid-month or mid-year.

Marriages carry an `endDate` (divorce, the spouse's death, or the person's own death), which draws the relationship bar. A divorce is also its own hollow `divorce` event. This maps directly onto Wikidata's spouse (P26) start/end time qualifiers.

## Data caveat

The current dataset was written by hand for prototyping and has **not been verified**, so some dates may be off. It's meant to be replaced by a Wikidata-based ingestion pipeline (next milestone).
