import React from 'react';
import PropTypes from 'prop-types';

const MachineDrawing = ({ laser }) => (
  <svg
    viewBox="0 0 700 380"
    role="img"
    aria-label={
      laser
        ? 'Shapeoko XL with laser attachment illustration'
        : 'Shapeoko XL with DeWalt router illustration'
    }
  >
    <defs>
      <pattern
        id="bed-lines"
        width="32"
        height="32"
        patternUnits="userSpaceOnUse"
      >
        <path d="M0 0V32" stroke="#b4ad9d" strokeWidth="1" />
      </pattern>
    </defs>
    <ellipse
      cx="355" cy="325" rx="265"
      ry="24" fill="#21272a" opacity=".08"
    />
    <path
      d="M100 237L487 147 617 263 226 352Z"
      fill="#bcb6a7"
      stroke="#8a897e"
      strokeWidth="2"
    />
    <path d="M118 237L484 162 596 262 230 335Z" fill="#dcd5c4" />
    <path d="M118 237L484 162 596 262 230 335Z" fill="url(#bed-lines)" />
    <path
      d="M100 231L226 339V355L100 249Z M488 144L619 255V274L488 162Z"
      fill="#30373a"
    />
    <path
      d="M107 199L238 304 249 295 117 191Z M474 115L606 218 618 210 486 107Z"
      fill="#788082"
    />
    <path
      d="M107 199V220L238 324V304Z M474 115V136L606 240V218Z"
      fill="#353e42"
    />
    <path d="M155 186L166 126 526 47 543 108 522 148 173 225Z" fill="#252e32" />
    <path d="M166 126L526 47 534 65 169 145Z" fill="#758083" />
    <path d="M175 165L532 88" stroke="#98a1a0" strokeWidth="5" />
    <path d="M175 184L532 107" stroke="#111b20" strokeWidth="8" />
    <path d="M325 98L372 87 389 179 339 192Z" fill="#626d70" />
    <path
      d="M338 94V59Q330 31 291 45"
      fill="none"
      stroke="#313c40"
      strokeWidth="8"
    />
    {laser ? (
      <g>
        <path d="M338 138L371 130 383 202 349 211Z" fill="#297a85" />
        <path d="M350 211L383 202 377 218 358 223Z" fill="#222e32" />
        <path
          d="M367 220L370 252"
          stroke="#dd6b43"
          strokeWidth="2"
          strokeDasharray="4 5"
        />
      </g>
    ) : (
      <g>
        <path
          d="M326 119Q347 98 374 109L391 184Q375 207 342 198Z"
          fill="#e5b42b"
        />
        <path
          d="M326 119Q348 136 378 121"
          fill="none"
          stroke="#50462d"
          strokeWidth="6"
        />
        <path d="M342 175L388 164 392 184 348 197Z" fill="#273136" />
        <path d="M354 197L382 189 384 208 360 216Z" fill="#a4aca9" />
        <path d="M369 214L374 241" stroke="#4d595b" strokeWidth="6" />
      </g>
    )}
    <circle
      cx="179" cy="193" r="7"
      fill="#a8b0ac"
    />
    <circle
      cx="516" cy="119" r="7"
      fill="#a8b0ac"
    />
    <path
      d="M247 298L584 225"
      stroke="#ede7d7"
      strokeWidth="2"
      strokeDasharray="5 5"
    />
    <text
      x="52" y="343" fontSize="10"
      fill="#7b817f" letterSpacing="2"
    >
      SHAPEOKO 3 XL / CONFIGURATION VIEW
    </text>
  </svg>
);
MachineDrawing.propTypes = { laser: PropTypes.bool };
export default MachineDrawing;
