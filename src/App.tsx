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
          <span className="accent">life</span> timelines
        </h1>
      </header>
      <Legend focus={focus} onSelect={(id) => setFocus((cur) => (cur === id ? null : id))} />
      <Timeline people={PEOPLE} hidden={hidden} cursorAge={cursorAge} onCursorChange={setCursorAge} />
    </div>
  );
}
