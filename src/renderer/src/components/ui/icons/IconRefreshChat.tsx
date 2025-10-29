import React from 'react'

export const IconRefreshChat: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns='http://www.w3.org/2000/svg'
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='1.5'
    strokeLinecap='round'
    strokeLinejoin='round'
    {...props}
  >
    <path d='M3 11a8 8 0 0 1 13.66-5.66' />
    <polyline points='3 4 3 11 10 11' />
    <path d='M21 13a8 8 0 0 1-13.66 5.66' />
    <polyline points='21 20 21 13 14 13' />
  </svg>
)

export default IconRefreshChat
