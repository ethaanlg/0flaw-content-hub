export default function AnalyticsLoading() {
  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div className="skeleton" style={{ height: 40, width: 180, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 36, width: 90, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 36, width: 90, borderRadius: 8 }} />
        </div>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ flex: 1, height: 100, borderRadius: 12 }} />
        ))}
      </div>

      {/* Chart */}
      <div className="skeleton" style={{ height: 260, borderRadius: 12, marginBottom: 32 }} />

      {/* Table */}
      <div className="skeleton" style={{ height: 320, borderRadius: 12 }} />
    </div>
  )
}
