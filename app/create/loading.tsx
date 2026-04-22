export default function CreateLoading() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px' }}>
      {/* Title */}
      <div className="skeleton" style={{ height: 36, width: 240, borderRadius: 8, marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 16, width: 300, borderRadius: 6, marginBottom: 40 }} />

      {/* Step indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 8, flex: 1, borderRadius: 4 }} />
        ))}
      </div>

      {/* Form fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="skeleton" style={{ height: 56, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 120, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 56, borderRadius: 10 }} />
        <div className="skeleton" style={{ height: 48, width: 160, borderRadius: 10 }} />
      </div>
    </div>
  )
}
