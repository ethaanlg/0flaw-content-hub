export default function SettingsLoading() {
  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>
      <div className="skeleton" style={{ height: 36, width: 160, borderRadius: 8, marginBottom: 32 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="skeleton" style={{ height: 64, borderRadius: 10 }} />
        ))}
      </div>
    </div>
  )
}
