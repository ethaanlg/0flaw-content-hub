'use client';

type Platform = 'linkedin' | 'instagram';
type Size = 'sm' | 'md';

interface PlatformBadgeProps {
  platform: Platform;
  size?: Size;
}

const linkedInIcon = (
  <svg viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"
    />
  </svg>
);

const instagramIcon = (
  <svg viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
    />
  </svg>
);

const config: Record<
  Platform,
  { bg: string; color: string; icon: JSX.Element; label: string }
> = {
  linkedin: {
    bg: '#0077b522',
    color: '#4da3d4',
    icon: linkedInIcon,
    label: 'LinkedIn',
  },
  instagram: {
    bg: '#e1306c22',
    color: '#e1306c',
    icon: instagramIcon,
    label: 'Instagram',
  },
};

const sizeConfig: Record<
  Size,
  { padding: string; fontSize: string; gap: string; iconSize: number }
> = {
  sm: { padding: '3px 8px', fontSize: '10px', gap: '4px', iconSize: 10 },
  md: { padding: '5px 12px', fontSize: '12px', gap: '6px', iconSize: 13 },
};

export default function PlatformBadge({
  platform,
  size = 'md',
}: PlatformBadgeProps) {
  const { bg, color, icon, label } = config[platform];
  const { padding, fontSize, gap, iconSize } = sizeConfig[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        padding,
        fontSize,
        color,
        backgroundColor: bg,
        borderRadius: '100px',
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        lineHeight: 1,
      }}
    >
      <span
        style={{
          width: iconSize,
          height: iconSize,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      {label}
    </span>
  );
}
