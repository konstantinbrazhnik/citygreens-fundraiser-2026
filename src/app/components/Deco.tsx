/** The sunburst from the poster corners, as an SVG we can tint and scale. */
export function Sunburst({ className = '', flip = false }: { className?: string; flip?: boolean }) {
  const rays = Array.from({ length: 14 }, (_, i) => (i * 90) / 13);
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className} style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <g stroke="#d8a850" strokeWidth="2" fill="none" opacity="0.8">
        {rays.map((a) => (
          <line key={a} x1="0" y1="0" x2={200 * Math.cos((a * Math.PI) / 180)} y2={200 * Math.sin((a * Math.PI) / 180)} opacity={0.35 + 0.5 * Math.abs(Math.sin((a * Math.PI) / 45))} />
        ))}
        <circle cx="0" cy="0" r="70" strokeWidth="6" />
        <circle cx="0" cy="0" r="56" strokeWidth="2" strokeDasharray="4 6" />
        <circle cx="0" cy="0" r="40" strokeWidth="10" />
        <circle cx="0" cy="0" r="22" fill="#d8a850" stroke="none" />
      </g>
    </svg>
  );
}

/** The stepped gold fan from the poster's right edge. */
export function Fan({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 300 600" aria-hidden="true" className={className} preserveAspectRatio="none">
      <polygon points="300,0 300,600 160,600" fill="#a07830" />
      <polygon points="300,60 300,600 200,600" fill="#d8a850" />
      <polygon points="300,130 300,600 240,600" fill="#fff8dd" />
      <polygon points="300,210 300,600 270,600" fill="#d8a850" />
    </svg>
  );
}
