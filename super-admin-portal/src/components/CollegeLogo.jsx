import React from 'react';
import mccLogo from '/image.png';

export default function CollegeLogo({ className = "h-16 w-auto" }) {
  return (
    <img
      src={mccLogo}
      alt="MCC Crest Logo"
      className={`${className} object-contain shrink-0`}
    />
  );
}

