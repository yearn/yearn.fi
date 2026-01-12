import { Dialog, Transition } from '@headlessui/react'
import { Button } from '@lib/components/Button'
import { type FC, Fragment, useEffect, useState } from 'react'
import { useReward } from 'react-rewards'

interface SuccessModalProps {
  isOpen: boolean
  onClose: () => void
  onAfterClose?: () => void
  title: string
  message: string
  buttonText?: string
  showConfetti?: boolean
}

// Animated success checkmark component
const AnimatedCheckmark: FC<{ isVisible: boolean }> = ({ isVisible }) => {
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

export const SuccessModal: FC<SuccessModalProps> = ({
  isOpen,
  onClose,
  onAfterClose,
  title,
  message,
  buttonText = 'Got it!',
  showConfetti = false
}) => {
  const { reward } = useReward('successConfetti', 'confetti', {
    spread: 80,
    elementCount: 80,
    startVelocity: 35,
    decay: 0.91,
    lifetime: 200,
    colors: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']
  })

  // biome-ignore lint/correctness/useExhaustiveDependencies: excessive dep
  useEffect(() => {
    if (isOpen && showConfetti) {
      const timeout = setTimeout(() => reward(), 100)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [isOpen, showConfetti])

  return (
    <Transition appear show={isOpen} as={Fragment} afterLeave={onAfterClose}>
      <Dialog as="div" className="relative z-70" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-hidden">
          <div className="flex min-h-full items-center justify-center p-4 text-center overflow-y-auto">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform rounded-2xl bg-surface p-6 text-left align-middle shadow-xl transition-all relative">
                {/* Animated success icon */}
                <div className="flex justify-center mb-4 relative">
                  {/** biome-ignore lint/correctness/useUniqueElementIds: rewards api needs id */}
                  <span id="successConfetti" className="absolute top-1/2 left-1/2" />
                  <AnimatedCheckmark isVisible={isOpen} />
                </div>

                <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-text-primary mb-2 text-center">
                  {title}
                </Dialog.Title>

                <p className="text-sm text-text-secondary text-center mb-6 whitespace-pre-line">{message}</p>

                <Button
                  onClick={onClose}
                  variant="filled"
                  className="w-full"
                  classNameOverride="yearn--button--nextgen w-full"
                >
                  {buttonText}
                </Button>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
