import { type FC, useEffect, useState } from 'react'

export const AnimatedCheckmark: FC<{ isVisible: boolean }> = ({ isVisible }) => {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    if (isVisible) {
      const timeout = setTimeout(() => setAnimate(true), 100)
      return () => clearTimeout(timeout)
    }
    setAnimate(false)
    return undefined
  }, [isVisible])

  return (
    <div
      className={`w-14 h-14 rounded-full border-2 border-green-500 flex items-center justify-center transition-all duration-300 ${
        animate ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
      }`}
    >
      <svg className="w-7 h-7 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 13l4 4L19 7"
          style={{
            strokeDasharray: 30,
            strokeDashoffset: animate ? 0 : 30,
            transition: 'stroke-dashoffset 0.4s ease-out 0.15s'
          }}
        />
      </svg>
    </div>
  )
}

export const Spinner: FC = () => (
  <div className="w-12 h-12 border-3 border-border border-t-primary rounded-full animate-spin" />
)

export const ErrorIcon: FC = () => (
  <div className="w-14 h-14 rounded-full border-2 border-red-500 flex items-center justify-center">
    <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </div>
)
