import React from 'react';
import mccCrest from '../assets/mcc_crest.png';

export default function CollegeLogo({ className = "h-14 sm:h-16 w-auto" }) {
  return (
    <img
      src={mccCrest}
      alt="MCC Crest Logo"
      className={`${className} object-contain shrink-0 max-h-full`}
      loading="eager"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = '/mcc_crest.png';
      }}
    />
  );
}
