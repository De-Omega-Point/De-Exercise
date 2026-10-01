type OmegaBrandMarkProps = {
  className?: string;
  compact?: boolean;
};

export function OmegaBrandMark({ className = "", compact = false }: OmegaBrandMarkProps) {
  return (
    <div className={`omega-brand ${compact ? "compact" : ""} ${className}`.trim()}>
      <svg
        className="omega-brand-mark"
        viewBox="0 0 120 120"
        role="img"
        aria-label="De-Omega-Point Omega human circuit mark"
      >
        <g fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path strokeWidth="6" d="M26 94H14c9-10 13-20 13-32C27 30 42 11 60 11s33 19 33 51c0 12 4 22 13 32H94" />
          <path strokeWidth="5" d="M38 94c7-12 10-25 10-39 0-16 5-27 12-27s12 11 12 27c0 14 3 27 10 39" />
          <path strokeWidth="3" d="M60 32v42M60 48 48 58m12-10 13 9M48 58v20m25-21v22" />
          <circle cx="60" cy="32" r="3" fill="currentColor" />
          <circle cx="48" cy="58" r="3" fill="currentColor" />
          <circle cx="73" cy="57" r="3" fill="currentColor" />
        </g>
      </svg>
      {!compact && (
        <div className="omega-brand-copy">
          <strong>DE-OMEGA-POINT</strong>
          <small>HUMAN-VALUE-CENTRIC INTELLIGENCE</small>
        </div>
      )}
    </div>
  );
}
