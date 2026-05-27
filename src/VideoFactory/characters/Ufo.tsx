import React from "react";

export const Ufo: React.FC = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="200"
    height="200"
    viewBox="0 0 124 124"
    fill="none"
  >
    <defs>
      <linearGradient id="ufoGradient-purple" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1F1F1F" />
        <stop offset="100%" stopColor="#141414" />
      </linearGradient>
      <linearGradient id="ufoGradient-grey" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1F1F1F" />
        <stop offset="100%" stopColor="#331414143" />
      </linearGradient>
      <linearGradient id="ufoGradient-blue" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1F1F1F" />
        <stop offset="100%" stopColor="#141414" />
      </linearGradient>
      <linearGradient id="ufoGradient-yellow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1F1F1F" />
        <stop offset="100%" stopColor="#141414" />
      </linearGradient>
    </defs>
    <g
      stroke="#141414"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
      transform="translate(2 -8)"
    >
      <rect x="55" y="50" width="10" height="10" fill="url(#ufoGradient-purple)" />
      <rect x="57.5" y="60" width="5" height="20" fill="url(#ufoGradient-grey)" />
      <rect x="35" y="80" width="50" height="5" fill="url(#ufoGradient-grey)" />
      <rect x="30" y="85" width="60" height="10" fill="url(#ufoGradient-blue)" />
      <rect x="20" y="95" width="80" height="20" fill="url(#ufoGradient-yellow)" />
      <rect x="40" y="115" width="40" height="5" fill="url(#ufoGradient-grey)" />
      <rect x="35" y="100" width="10" height="10" fill="url(#ufoGradient-purple)" />
      <rect x="55" y="100" width="10" height="10" fill="url(#ufoGradient-purple)" />
      <rect x="75" y="100" width="10" height="10" fill="url(#ufoGradient-purple)" />
    </g>
  </svg>
);
