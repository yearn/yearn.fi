import type { ReactElement, SVGProps } from 'react'
import { useId } from 'react'

export function IconInfinifiPoints(props: SVGProps<SVGSVGElement>): ReactElement {
  const clipPathId = useId()
  const paint0Id = useId()
  const paint1Id = useId()

  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" {...props}>
      <g clipPath={`url(#${clipPathId})`}>
        <rect width="32" height="32" rx="16" fill="#27553D" />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M6.39684 18.9136C9.47234 21.9891 13.6161 22.8317 15.6521 20.7957C17.6882 18.7596 16.8455 14.6159 13.77 11.5404C10.6945 8.4649 6.5508 7.62226 4.51476 9.65831C2.47871 11.6944 3.32135 15.8381 6.39684 18.9136ZM8.01976 19.3229C10.7637 21.4654 13.9321 21.9931 15.0965 20.5018C16.261 19.0104 14.9805 16.0646 12.2365 13.9222C9.49254 11.7798 6.32416 11.252 5.15974 12.7434C3.99531 14.2347 5.27579 17.1805 8.01976 19.3229Z"
          fill={`url(#${paint0Id})`}
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M25.6022 13.2241C22.5267 10.1486 18.383 9.30598 16.3469 11.342C14.3109 13.3781 15.1535 17.5218 18.229 20.5973C21.3045 23.6728 25.4482 24.5154 27.4843 22.4794C29.5203 20.4433 28.6777 16.2996 25.6022 13.2241ZM24.0105 12.8461C21.2665 10.7036 18.0982 10.1758 16.9337 11.6672C15.7693 13.1586 17.0498 16.1044 19.7938 18.2468C22.5377 20.3892 25.7061 20.917 26.8706 19.4256C28.035 17.9343 26.7545 14.9885 24.0105 12.8461Z"
          fill={`url(#${paint1Id})`}
        />
        <path d="M16.7527 6.22168H19.7885L15.3191 25.7778H12.2832L16.7527 6.22168Z" fill="white" />
      </g>
      <defs>
        <linearGradient
          id={paint0Id}
          x1="11.5156"
          y1="18.9227"
          x2="13.2475"
          y2="21.7369"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.0726915" stopColor="white" />
          <stop offset="1" stopColor="#27553D" />
        </linearGradient>
        <linearGradient
          id={paint1Id}
          x1="19.8399"
          y1="14.6528"
          x2="18.7515"
          y2="10.4008"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="white" />
          <stop offset="1" stopColor="#27553D" />
        </linearGradient>
        <clipPath id={clipPathId}>
          <rect width="32" height="32" fill="white" />
        </clipPath>
      </defs>
    </svg>
  )
}
