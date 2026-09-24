"use client"

// Metric tile used for status summaries; metrics with onClick render as buttons (e.g. drill-down links)
export default function StatCard({ title, icon: Icon, iconClass, metrics, showBar = true, footer }) {
  const total = metrics.reduce((sum, m) => sum + (Number(m.value) || 0), 0)
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{title}</p>
        {Icon && (
          <div className={`rounded-lg p-2 ${iconClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((m) => {
          const content = (
            <>
              <p className={`text-2xl font-bold leading-tight tabular-nums ${m.textClass}`}>{m.value}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-gray-500">
                {m.barClass && <span className={`h-2 w-2 shrink-0 rounded-full ${m.barClass}`} />}
                <span className="truncate">{m.label}</span>
                {m.onClick && <span className="text-gray-400 transition-transform group-hover:translate-x-0.5">→</span>}
              </p>
            </>
          )
          return m.onClick ? (
            <button
              key={m.label}
              type="button"
              onClick={m.onClick}
              title={m.hint || `View ${m.label}`}
              className="group -m-1.5 min-w-0 rounded-lg p-1.5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {content}
            </button>
          ) : (
            <div key={m.label} className="min-w-0">
              {content}
            </div>
          )
        })}
      </div>
      {showBar && (
        <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-gray-100">
          {total > 0 &&
            metrics.map((m) =>
              Number(m.value) > 0 ? (
                <div
                  key={m.label}
                  className={`${m.barClass} transition-all duration-500`}
                  style={{ width: `${(Number(m.value) / total) * 100}%` }}
                  title={`${m.label}: ${m.value}`}
                />
              ) : null,
            )}
        </div>
      )}
      {footer && <div className="mt-3 text-xs text-gray-500">{footer}</div>}
    </div>
  )
}
