import { useMemo, useState } from "react";
import { PEOPLE } from "./data/people";
import { Legend } from "./Legend";
import { Timeline } from "./Timeline";
import { EVENT_TYPES, LEGEND_GROUPS, type EventType } from "./model";

export default function App() {
  // Legend focus: null = show all types; otherwise only that group's types.
  const [focus, setFocus] = useState<string | null>(null);
  const [cursorAge, setCursorAge] = useState(32);

  const hidden = useMemo(() => {
    const group = LEGEND_GROUPS.find((g) => g.id === focus);
    // Death has no legend entry, so it is never hidden.
    return new Set<EventType>(
      group ? EVENT_TYPES.filter((t) => t !== "death" && !group.types.includes(t)) : [],
    );
  }, [focus]);

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          <a
            className="info-link"
            href="https://github.com/EmilyReif/life_timelines#readme"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="about this project (readme on github)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="8" cy="4.8" r="1" fill="currentColor" />
              <line x1="8" y1="7.2" x2="8" y2="11.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </a>
          <span className="accent">life</span> timelines
        </h1>
      </header>
      <Legend focus={focus} onSelect={(id) => setFocus((cur) => (cur === id ? null : id))} />
      <Timeline people={PEOPLE} hidden={hidden} cursorAge={cursorAge} onCursorChange={setCursorAge} />
    </div>
  );
}
