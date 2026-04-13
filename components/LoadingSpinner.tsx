'use client';

interface LoadingSpinnerProps {
  size?: number;
  label?: string;
  color?: string;
}

export default function LoadingSpinner({
  size = 32,
  label,
  color = 'var(--accent)',
}: LoadingSpinnerProps) {
  return (
    <>
      <style>{`
        @keyframes loadingSpinnerRotate {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            border: `2.5px solid rgba(255,255,255,0.08)`,
            borderTopColor: color,
            animation: 'loadingSpinnerRotate 0.7s linear infinite',
            flexShrink: 0,
          }}
        />
        {label && (
          <span
            style={{
              fontSize: '12px',
              fontFamily: "'Space Mono', monospace",
              color: 'var(--muted)',
              marginTop: '10px',
            }}
          >
            {label}
          </span>
        )}
      </div>
    </>
  );
}
