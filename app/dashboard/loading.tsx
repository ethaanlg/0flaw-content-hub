export default function DashboardLoading() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header */}
      <div className="skeleton" style={{ height: 36, width: 200, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 160, borderRadius: 6, marginBottom: 36 }} />

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 36 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 96, borderRadius: 12 }} />
        ))}
      </div>

      {/* Next post */}
      <div className="skeleton" style={{ height: 100, borderRadius: 12, marginBottom: 36 }} />

      {/* Chart */}
      <div className="skeleton" style={{ height: 200, borderRadius: 12, marginBottom: 36 }} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 24 }}>
        <div className="skeleton" style={{ flex: 1, height: 140, borderRadius: 12 }} />
        <div className="skeleton" style={{ width: 220, height: 140, borderRadius: 12 }} />
      </div>
    </div>
  )
}
