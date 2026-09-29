import { LEGEND_GROUPS, PAGE_BG, TYPE_META, type EventType } from "./model";

type Props = {
  /** Focused group id, or null when all types are shown. */
  focus: string | null;
  onSelect: (groupId: string) => void;
};

const R = 4.5;
const HOLLOW_STROKE = 1.6;

function Swatch({ types }: { types: EventType[] }) {
  if (types.includes("marriage")) {
    // Mini version of how relationships are drawn: start ● ─ bar ─ ○ end.
    const c = TYPE_META.marriage.color;
    return (
      <svg width="26" height="12" aria-hidden="true">
        <rect x={5 - R} y={6 - R} width={16 + R * 2} height={R * 2} rx={R} fill={c} opacity="0.6" />
        <circle cx="5" cy="6" r={R} fill={c} />
        <circle cx="21" cy="6" r={R - HOLLOW_STROKE / 2} fill={PAGE_BG} stroke={c} strokeWidth={HOLLOW_STROKE} />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" aria-hidden="true">
      <circle cx="6" cy="6" r={R} fill={TYPE_META[types[0]].color} />
    </svg>
  );
}

export function Legend({ focus, onSelect }: Props) {
  return (
    <div className="legend" role="group" aria-label="Show only one event type">
      {LEGEND_GROUPS.map((g) => {
        const active = focus === g.id;
        const dimmed = focus !== null && !active;
        return (
          <button
            key={g.id}
            type="button"
            className={`legend-item${active ? " active" : ""}${dimmed ? " off" : ""}`}
            aria-pressed={active}
            onClick={() => onSelect(g.id)}
          >
            <Swatch types={g.types} />
            {g.label}
          </button>
        );
      })}
    </div>
  );
}
