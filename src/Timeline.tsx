import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import {
  PAGE_BG,
  TYPE_META,
  lifespan,
  placeEvents,
  wholeAge,
  yearOf,
  type EventType,
  type PlacedEvent,
  type Person,
} from "./model";

const AXIS_W = 48; // left gutter for age labels
const HEADER_H = 54; // sticky name row
const TOP_PAD = 8;
const BOTTOM_PAD = 20;
const MIN_COL_W = 58;
const MIN_PX_PER_YEAR = 7;
const MARKER_R = 4;
const MARKER_R_ACTIVE = 6;
const ENDPOINT_R = 2.5; // birth and death dots on the lifeline
const HOLLOW_STROKE = 1.6;
const TIP_MAX_W = 220;
const LIFELINE_W = 1; // keep in sync with .lifeline stroke-width
const LINE_COLOR = TYPE_META.death.color; // lifeline, birth and death dots share one gray
const MARKER_OPACITY = 0.6; // markers + bars; overlaps stay visible
const BAR_GAP = 2; // px between back-to-back spans in one lane

type Props = {
  people: Person[];
  hidden: Set<EventType>;
  cursorAge: number;
  onCursorChange: (age: number) => void;
};

/** `drawAge` is where the dot is drawn; usually `age`, nudged a hair to keep split bars readable. */
type Point = PlacedEvent & { dx: number; drawAge: number };
/** A span; `top`/`bottom` are in years and include the rounded end caps. */
type Bar = Point & { top: number; bottom: number };

type Column = {
  person: Person;
  span: number;
  points: Point[];
  bars: Bar[];
};

/**
 * Horizontal offset for a lane (see TYPE_META.lane). Lanes are packed with no
 * gaps: lane ±1 touches the lifeline, lane ±2 touches lane ±1.
 */
const laneX = (lane: number) =>
  lane === 0 ? 0 : Math.sign(lane) * (LIFELINE_W / 2 + MARKER_R * (2 * Math.abs(lane) - 1));

/**
 * Positions one person's events.
 * - An outer-lane event (e.g. "other") slides into the inner lane when nothing
 *   in the inner lane overlaps it vertically.
 * - Back-to-back bars in the same lane (divorce + remarriage in the same year)
 *   get a BAR_GAP so they read as separate spans.
 */
function layoutColumn(placed: PlacedEvent[], pxPerYear: number): { points: Point[]; bars: Bar[] } {
  const rY = MARKER_R / pxPerYear;
  const gapY = BAR_GAP / pxPerYear;
  const laneOf = (p: PlacedEvent) => TYPE_META[p.event.type].lane;
  const extent = (p: PlacedEvent) => [p.age - rY, (p.endAge ?? p.age) + rY];

  const points = placed.map((p) => {
    let lane = laneOf(p);
    if (Math.abs(lane) === 2) {
      const inner = Math.sign(lane);
      const [top, bottom] = extent(p);
      const blocked = placed.some((q) => {
        if (laneOf(q) !== inner) return false;
        const [qTop, qBottom] = extent(q);
        return top < qBottom && qTop < bottom;
      });
      if (!blocked) lane = inner;
    }
    return { ...p, dx: laneX(lane), drawAge: p.age };
  });

  const bars: Bar[] = points
    .filter((p) => p.endAge !== undefined)
    .map((p) => ({ ...p, top: p.age - rY, bottom: p.endAge! + rY }));
  for (const a of bars) {
    for (const b of bars) {
      // b (the later span) starts right around where a ends: their end caps touch/overlap
      if (a === b || a.dx !== b.dx || b.age <= a.age || Math.abs(b.age - a.endAge!) > 2 * rY) continue;
      const mid = (a.endAge! + b.age) / 2;
      a.bottom = Math.min(a.bottom, mid - gapY / 2);
      b.top = Math.max(b.top, mid + gapY / 2);
      // Keep the end dot (e.g. divorce) and the next start dot inside their own caps.
      for (const p of points) {
        if (p.key === b.key) p.drawAge = b.top + rY;
        else if (p.dx === a.dx && p.key !== a.key && Math.abs(p.age - a.endAge!) < 1e-6) {
          p.drawAge = a.bottom - rY;
        }
      }
    }
  }
  return { points, bars };
}

/** Event starts within the 1-year band → enlarged + labeled. */
function isAtAge(ev: PlacedEvent, age: number) {
  return wholeAge(ev.age) === age;
}

export function Timeline({ people, hidden, cursorAge, onCursorChange }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spans = useMemo(() => people.map(lifespan), [people]);
  const maxAge = Math.ceil(Math.max(40, ...spans) / 5) * 5;
  const colW = Math.max(MIN_COL_W, (size.w - AXIS_W) / Math.max(1, people.length));
  const pxPerYear = Math.max(MIN_PX_PER_YEAR, (size.h - HEADER_H - TOP_PAD - BOTTOM_PAD) / maxAge);
  const y = (age: number) => TOP_PAD + age * pxPerYear;
  const colX = (i: number) => AXIS_W + colW * i + colW / 2;
  const width = AXIS_W + colW * people.length;
  const bodyH = y(maxAge) + BOTTOM_PAD;

  const columns: Column[] = useMemo(
    () =>
      people.map((person, i) => ({
        person,
        span: spans[i],
        ...layoutColumn(
          placeEvents(person).filter((p) => !hidden.has(p.event.type)),
          pxPerYear,
        ),
      })),
    [people, spans, hidden, pxPerYear],
  );

  // ----- cursor dragging -----
  const ageFromPointer = (e: PointerEvent) => {
    const rect = bodyRef.current!.getBoundingClientRect();
    const a = Math.floor((e.clientY - rect.top - TOP_PAD) / pxPerYear);
    return Math.min(maxAge - 1, Math.max(0, a));
  };
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    setSelectedKey(null);
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    onCursorChange(ageFromPointer(e));
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    // Mouse: the band follows hover. Touch/pen: only while dragging.
    if (dragging.current || e.pointerType === "mouse") onCursorChange(ageFromPointer(e));
  };
  const endDrag = () => {
    dragging.current = false;
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowUp") onCursorChange(Math.max(0, cursorAge - step));
    else if (e.key === "ArrowDown") onCursorChange(Math.min(maxAge - 1, cursorAge + step));
    else if (e.key === "Escape") setSelectedKey(null);
    else return;
    e.preventDefault();
  };

  // ----- small tip next to the selected (clicked) marker -----
  let tip: { text: string; style: CSSProperties } | null = null;
  for (let i = 0; selectedKey && i < columns.length; i++) {
    const item = columns[i].points.find((p) => p.key === selectedKey);
    if (!item) continue;
    const x = colX(i) + item.dx;
    const totalW = Math.max(width, size.w);
    let goLeft = item.dx < 0; // open outward, away from the lifeline
    if (goLeft && x - 12 - TIP_MAX_W < 0) goLeft = false;
    if (!goLeft && x + 12 + TIP_MAX_W > totalW) goLeft = true;
    tip = {
      text: `${item.event.title} (age ${wholeAge(item.age)})`,
      style: goLeft ? { right: totalW - x + 12, top: y(item.drawAge) } : { left: x + 12, top: y(item.drawAge) },
    };
    break;
  }

  const ticks: number[] = [];
  for (let a = 0; a <= maxAge; a += 5) ticks.push(a);

  const bandTop = y(cursorAge);
  const bandBottom = y(cursorAge + 1);

  return (
    <div className="chart-scroll" ref={scrollRef} tabIndex={0} onKeyDown={onKeyDown}>
      <div className="chart-inner" style={{ width }}>
        {/* Sticky name header */}
        <div className="col-header" style={{ height: HEADER_H, paddingLeft: AXIS_W }}>
          {columns.map(({ person }) => (
            <div key={person.id} className="col-head" style={{ width: colW }} title={person.name}>
              <div className="col-name first">{person.firstName}</div>
              <div className="col-name last">{person.shortName}</div>
              <div className="col-years">
                {yearOf(person.birthDate)}–{person.deathDate ? yearOf(person.deathDate) : ""}
              </div>
            </div>
          ))}
        </div>

        {/* Chart body: pointer anywhere moves the age cursor */}
        <div
          className="chart-body"
          ref={bodyRef}
          style={{ height: bodyH }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <svg width={width} height={bodyH} className="chart-svg">
            {/* age axis labels (no background grid lines) */}
            {ticks.map((a) => (
              <text key={a} x={AXIS_W - 10} y={y(a)} className="axis-label" dy="0.32em">
                {a}
              </text>
            ))}

            {/* age cursor band */}
            <rect x={AXIS_W} y={bandTop} width={width - AXIS_W} height={bandBottom - bandTop} className="band" />
            <g transform={`translate(4, ${(bandTop + bandBottom) / 2})`} className="cursor-tag">
              <rect x={0} y={-10} width={AXIS_W - 8} height={20} rx={4} />
              <text x={(AXIS_W - 8) / 2} dy="0.35em">
                {cursorAge}
              </text>
            </g>

            {columns.map((col, i) => (
              <g key={col.person.id} transform={`translate(${colX(i)}, 0)`}>
                {/* lifeline: birth → death, all in the same gray */}
                <line x1={0} x2={0} y1={y(0)} y2={y(col.span)} className="lifeline" stroke={LINE_COLOR} />
                <circle cx={0} cy={y(0)} r={ENDPOINT_R} fill={LINE_COLOR} />

                {/* spans (events with an end date) */}
                {col.bars.map((b) => (
                  <rect
                    key={`bar-${b.key}`}
                    x={b.dx - MARKER_R}
                    y={y(b.top)}
                    width={MARKER_R * 2}
                    height={Math.max(0, y(b.bottom) - y(b.top))}
                    rx={MARKER_R}
                    fill={TYPE_META[b.event.type].color}
                    opacity={MARKER_OPACITY}
                  />
                ))}

                {/* event markers */}
                {col.points.map((p) => {
                  const meta = TYPE_META[p.event.type];
                  const active = isAtAge(p, cursorAge);
                  const selected = p.key === selectedKey;
                  const r =
                    p.event.type === "death" ? ENDPOINT_R : active || selected ? MARKER_R_ACTIVE : MARKER_R;
                  const cy = y(p.drawAge);
                  return (
                    <g key={p.key}>
                      {selected && (
                        <circle cx={p.dx} cy={cy} r={r + 2.5} fill="none" stroke="#111" strokeWidth={1.5} />
                      )}
                      <circle
                        className="marker"
                        cx={p.dx}
                        cy={cy}
                        // Hollow: shrink so the outer edge of the stroke matches filled markers.
                        r={meta.hollow ? r - HOLLOW_STROKE / 2 : r}
                        fill={meta.hollow ? PAGE_BG : meta.color}
                        stroke={meta.hollow ? meta.color : "none"}
                        strokeWidth={meta.hollow ? HOLLOW_STROKE : 0}
                        opacity={p.event.type === "death" ? 1 : MARKER_OPACITY}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setSelectedKey(p.key)}
                      />
                    </g>
                  );
                })}
              </g>
            ))}
          </svg>

          {/* inline labels for events in the cursor band: up to ~1.4 columns wide, alternating
              below/above by column so neighboring boxes never overlap */}
          {columns.map((col, i) => {
            const items = col.points.filter((p) => isAtAge(p, cursorAge));
            if (items.length === 0) return null;
            const canBelow = bandBottom + 90 < bodyH;
            const canAbove = bandTop - 90 > 0;
            const below = canBelow && (i % 2 === 0 || !canAbove);
            const pos: CSSProperties = below ? { top: bandBottom + 4 } : { bottom: bodyH - bandTop + 4 };
            const boxW = colW * 1.4;
            const x = colX(i);
            const hPos: CSSProperties =
              x - boxW / 2 < AXIS_W
                ? { left: AXIS_W }
                : x + boxW / 2 > width
                  ? { right: 0 }
                  : { left: x, transform: "translateX(-50%)" };
            return (
              <div
                key={col.person.id}
                className="band-labels"
                style={{ ...pos, ...hPos, maxWidth: boxW }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {items.map((p) => (
                  <button
                    type="button"
                    key={p.key}
                    className="band-label"
                    onClick={() => setSelectedKey(p.key)}
                  >
                    {p.event.title}
                  </button>
                ))}
              </div>
            );
          })}

          {tip && (
            <div className="tip" style={tip.style} role="tooltip">
              {tip.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
