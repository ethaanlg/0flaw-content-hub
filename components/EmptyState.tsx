'use client';

type IconType = 'calendar' | 'chart' | 'post' | 'settings';

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  subtitle?: string;
  cta?: { label: string; href: string };
}

const icons: Record<IconType, JSX.Element> = {
  calendar: (
    <svg viewBox="0 0 24 24" width="64" height="64">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        d="M8 2v3m8-3v3M3.5 9.09h17M21 8.5V17c0 3-1.5 5-5 5H8c-3.5 0-5-2-5-5V8.5c0-3 1.5-5 5-5h8c3.5 0 5 2 5 5z"
      />
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M11.995 13.7h.01m0 3h.01M15.99 13.7h.01M8 13.7h.01M8 16.7h.01"
      />
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" width="64" height="64">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        d="M2 22h20M5 22V10l5-5 5 5V22M5 22V10M10 5V22m5-12v12M15 10V22"
      />
    </svg>
  ),
  post: (
    <svg viewBox="0 0 24 24" width="64" height="64">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        d="M9 22H15c5 0 7-2 7-7V9c0-5-2-7-7-7H9C4 2 2 4 2 9v6c0 5 2 7 7 7z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M7 8h10M7 12h7"
      />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 24 24" width="64" height="64">
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        d="M2 12.88v-1.76c0-1.04.85-1.9 1.9-1.9 1.81 0 2.55-1.28 1.64-2.85A1.9 1.9 0 016.16 3.8l1.73-1c.93-.56 2.14-.23 2.7.71l.11.19c.9 1.57 2.38 1.57 3.29 0l.11-.19c.56-.94 1.77-1.27 2.7-.71l1.73 1a1.9 1.9 0 01.68 2.58c-.91 1.57-.17 2.85 1.64 2.85 1.04 0 1.9.85 1.9 1.9v1.76c0 1.04-.86 1.9-1.9 1.9-1.81 0-2.55 1.28-1.64 2.85a1.9 1.9 0 01-.68 2.57l-1.73 1c-.93.56-2.14.23-2.7-.71l-.11-.19c-.91-1.57-2.39-1.57-3.29 0l-.11.19c-.56.94-1.77 1.27-2.7.71l-1.73-1a1.9 1.9 0 01-.68-2.57c.91-1.57.17-2.85-1.64-2.85-1.04 0-1.9-.86-1.9-1.9z"
      />
    </svg>
  ),
};

export default function EmptyState({
  icon,
  title,
  subtitle,
  cta,
}: EmptyStateProps) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '48px 24px',
      }}
    >
      {icon && (
        <div
          style={{
            width: 80,
            height: 80,
            backgroundColor: 'rgba(79,111,255,0.08)',
            borderRadius: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto',
            color: 'rgba(79,111,255,0.35)',
          }}
        >
          {icons[icon]}
        </div>
      )}

      <h3
        style={{
          fontFamily: "'Syne', sans-serif",
          fontWeight: 800,
          fontSize: 18,
          color: '#ffffff',
          marginTop: 20,
          marginBottom: 0,
        }}
      >
        {title}
      </h3>

      {subtitle && (
        <p
          style={{
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.6,
            marginTop: 8,
            marginBottom: 0,
            maxWidth: 300,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {subtitle}
        </p>
      )}

      {cta && (
        <div style={{ marginTop: 24 }}>
          <a href={cta.href} className="btn btn-primary">
            {cta.label}
          </a>
        </div>
      )}
    </div>
  );
}
