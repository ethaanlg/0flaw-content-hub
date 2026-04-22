export default function CalendarLoading() {
  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px' }}>
      {/* Header nav */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div className="skeleton" style={{ height: 36, width: 200, borderRadius: 8 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="skeleton" style={{ height: 36, width: 36, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 36, width: 120, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 36, width: 36, borderRadius: 8 }} />
        </div>
      </div>

      {/* Calendar grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 32, borderRadius: 6 }} />
        ))}
        {[...Array(35)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 80, borderRadius: 8 }} />
        ))}
      </div>
    </div>
  )
}
