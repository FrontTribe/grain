export function Mark({ size = 24, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="grain"
      role="img"
    >
      <rect x="20" y="28" width="11" height="64" rx="4.5" className="fill-human" />
      <rect x="37" y="36" width="11" height="48" rx="4.5" className="fill-ai" />
      <rect x="54" y="20" width="11" height="80" rx="4.5" className="fill-human" />
      <rect x="71" y="38" width="11" height="44" rx="4.5" className="fill-ai" />
      <rect x="88" y="31" width="11" height="58" rx="4.5" className="fill-human" />
    </svg>
  );
}
