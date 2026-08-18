import React from 'react';

export const BrandLogo: React.FC<{ size?: number }> = ({ size = 38 }) => {
  return (
    <div className="brand-logo-container" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="brand-logo-svg"
      >
        <defs>
          <linearGradient id="oneufy-brand-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#1a6eff" />
            <stop offset="50%" stopColor="#0b52c7" />
            <stop offset="100%" stopColor="#002d73" />
          </linearGradient>

          <linearGradient id="oneufy-brand-border" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#93c5fd" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.3" />
          </linearGradient>

          <filter id="oneufy-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#004394" floodOpacity="0.5" />
          </filter>
        </defs>

        {/* Samsung Signature Smooth Squircle */}
        <rect
          width="40"
          height="40"
          rx="12"
          fill="url(#oneufy-brand-bg)"
          className="brand-squircle-fill"
        />

        {/* Crisp Ambient Rim Highlight */}
        <rect
          x="0.75"
          y="0.75"
          width="38.5"
          height="38.5"
          rx="11.25"
          stroke="url(#oneufy-brand-border)"
          strokeWidth="1.5"
        />

        {/* Status Wave Arc 1 (Base Dot/Curve) */}
        <circle cx="12" cy="27" r="2.2" fill="#ffffff" />

        {/* Status Wave Arc 2 (Middle Arc) */}
        <path
          d="M17.5 28C17.5 23.8579 14.1421 20.5 10 20.5"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Status Wave Arc 3 (Outer Arc) */}
        <path
          d="M23.5 28C23.5 20.5442 17.4558 14.5 10 14.5"
          stroke="#ffffff"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Customizer Magic Spark (Top-Right Accent) */}
        <path
          d="M27.5 9L28.8 13.2L33 14.5L28.8 15.8L27.5 20L26.2 15.8L22 14.5L26.2 13.2L27.5 9Z"
          fill="#60a5fa"
        />
        <circle cx="27.5" cy="14.5" r="1.2" fill="#ffffff" />

        {/* Micro Spark */}
        <circle cx="32" cy="8.5" r="1" fill="#93c5fd" />
      </svg>
    </div>
  );
};
