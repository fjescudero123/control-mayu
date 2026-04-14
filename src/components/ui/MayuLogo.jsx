import React from 'react';

const MayuLogo = ({ className }) => (
  <svg viewBox="0 0 260 140" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M30 65 L75 33 V65 H30Z" fill="#DCA75D"/>
    <path d="M78 31 L81 29 V65 H78 V31Z" fill="#DCA75D"/>
    <path d="M85 26 L115 5 V65 H85 V26Z" fill="#788A87"/>
    <path d="M118 3 L121 1 V65 H118 V3Z" fill="#DCA75D"/>
    <path d="M135 0 V65 H158 V20 L135 0Z" fill="#DCDDDF"/>
    <path d="M163 25 V65 H220 L163 25Z" fill="#899264"/>
    <text x="125" y="112" fontFamily="Arial, sans-serif" fontSize="48" fontWeight="900" textAnchor="middle" fill="#000000" letterSpacing="2">MAYU</text>
    <line x1="30" y1="122" x2="220" y2="122" stroke="#899264" strokeWidth="3" />
    <text x="125" y="136" fontFamily="Arial, sans-serif" fontSize="9" fontWeight="bold" textAnchor="middle" fill="#000000" letterSpacing="0.5">SOLUCIONES CONSTRUCTIVAS</text>
  </svg>
);

export default MayuLogo;
