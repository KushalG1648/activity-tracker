import { useState, useMemo } from 'react';

function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// sessions: array of { date: string, color: string, slug?: string }
export default function CalendarHeatmap({ sessions = [] }) {
  const [tooltip, setTooltip] = useState(null);

  const { columns, monthLabels } = useMemo(() => {
    // Build map: date → array of {color, slug}
    const dateMap = {};
    for (const s of sessions) {
      if (!dateMap[s.date]) dateMap[s.date] = [];
      dateMap[s.date].push({ color: s.color, slug: s.slug });
    }

    const today = new Date();
    const daysToSat = (6 - today.getDay() + 7) % 7;
    const gridEnd = new Date(today);
    gridEnd.setDate(today.getDate() + daysToSat);

    const gridStart = new Date(gridEnd);
    gridStart.setDate(gridEnd.getDate() - 363);

    const cols = [];
    const labels = [];
    const cursor = new Date(gridStart);
    let prevMonth = -1;

    for (let col = 0; col < 52; col++) {
      const week = [];
      for (let row = 0; row < 7; row++) {
        const dateStr = toISO(cursor);
        if (row === 0) {
          const mo = cursor.getMonth();
          if (mo !== prevMonth) {
            labels.push({ label: cursor.toLocaleDateString('en-IN', { month: 'short' }), colIndex: col });
            prevMonth = mo;
          }
        }
        week.push({ dateStr, entries: dateMap[dateStr] || [] });
        cursor.setDate(cursor.getDate() + 1);
      }
      cols.push(week);
    }

    const withSpan = labels.map((ml, i) => ({
      ...ml,
      colSpan: i + 1 < labels.length ? labels[i + 1].colIndex - ml.colIndex : 52 - ml.colIndex,
    }));

    return { columns: cols, monthLabels: withSpan };
  }, [sessions]);

  const PITCH = 15;

  function cellStyle(entries) {
    if (!entries.length) return {};
    if (entries.length === 1) return { background: entries[0].color };
    // Two or more: split vertically between first two
    const c1 = entries[0].color;
    const c2 = entries[1].color;
    return { background: `linear-gradient(90deg, ${c1} 50%, ${c2} 50%)` };
  }

  return (
    <div className="heatmap-wrap">
      <div className="heatmap-months">
        {monthLabels.map(({ label, colIndex, colSpan }) => (
          <span
            key={colIndex}
            className="heatmap-month-label"
            style={{ flex: `0 0 ${colSpan * PITCH}px` }}
          >
            {label}
          </span>
        ))}
      </div>

      <div className="heatmap-grid-wrap">
        <div className="heatmap-dow">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((lbl, i) => (
            <span key={i} className="heatmap-dow-label">{lbl}</span>
          ))}
        </div>

        <div className="heatmap-grid">
          {columns.map((week, ci) =>
            week.map((day, ri) => (
              <div
                key={day.dateStr}
                className={`heatmap-cell${day.entries.length ? ' heatmap-cell--active' : ''}`}
                style={{ gridColumn: ci + 1, gridRow: ri + 1, ...cellStyle(day.entries) }}
                onMouseEnter={e => setTooltip({ dateStr: day.dateStr, entries: day.entries, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
              />
            ))
          )}
        </div>
      </div>

      {tooltip && (
        <div
          className="heatmap-tooltip"
          style={{ left: tooltip.x + 12, top: tooltip.y - 38 }}
        >
          {new Date(tooltip.dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
          })}
          {tooltip.entries.length > 0 && (
            <span style={{ marginLeft: 6, opacity: 0.8 }}>
              · {tooltip.entries.map(e => e.slug).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
