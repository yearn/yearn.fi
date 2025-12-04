import type { ReactElement } from 'react'
import { useEffect, useMemo, useRef } from 'react'

type TextAnimationProps = {
  words?: string[]
  intervalMs?: number
  startDelayMs?: number
}

export function TextAnimation({
  words = ['STAKE', 'INVEST', 'BUILD', 'CHILL', 'LOCK', 'EARN', 'APE'],
  intervalMs = 6000,
  startDelayMs = 6000
}: TextAnimationProps): ReactElement {
  const hasBeenTriggered = useRef<boolean>(false)
  const intervalRef = useRef<number | undefined>(undefined)
  const delayRef = useRef<number | undefined>(undefined)
  const animationIdRef = useRef<string | null>(null)
  if (!animationIdRef.current) {
    animationIdRef.current = `text-animate-${Math.random().toString(36).slice(2)}`
  }
  const animationId = animationIdRef.current!
  const wordsSignature = useMemo(() => words.join('||'), [words])
  const wordEntries = useMemo(() => {
    const counts = new Map<string, number>()
    return words.map((word) => {
      const count = counts.get(word) ?? 0
      counts.set(word, count + 1)
      return { key: `${animationId}-${word}-${count}`, value: word }
    })
  }, [animationId, words])

  useEffect((): (() => void) | undefined => {
    if (typeof window === 'undefined') {
      return undefined
    }
    if (hasBeenTriggered.current) {
      return
    }
    hasBeenTriggered.current = true

    const container = document.querySelector(`[data-text-animate-id="${animationId}"]`)
    if (!container) {
      return
    }
    container.setAttribute('data-text-animate-signature', wordsSignature)
    const wordElements = container.getElementsByClassName('text-animate-word') as HTMLCollectionOf<HTMLSpanElement>
    if (wordElements.length === 0) {
      return
    }

    const wordArray: HTMLSpanElement[][] = []
    let currentWord = 0
    wordElements[currentWord].style.opacity = '1'

    for (const word of Array.from(wordElements)) {
      const isProcessed = word.getAttribute('data-text-animate-processed') === 'true'
      if (isProcessed) {
        const existingLetters = Array.from(word.getElementsByClassName('letter')) as HTMLSpanElement[]
        wordArray.push(existingLetters)
        continue
      }

      const content = word.textContent || ''
      word.textContent = ''
      const letters: HTMLSpanElement[] = []
      for (const char of content.split('')) {
        const letter = document.createElement('span')
        letter.className = 'letter'
        letter.textContent = char === ' ' ? '\u00A0' : char
        word.appendChild(letter)
        letters.push(letter)
      }
      word.setAttribute('data-text-animate-processed', 'true')
      wordArray.push(letters)
    }

    function animateLetterOut(current: HTMLSpanElement[], index: number): void {
      window.setTimeout((): void => {
        current[index].className = 'letter out'
      }, index * 40)
    }

    function animateLetterIn(nextLetters: HTMLSpanElement[], index: number): void {
      window.setTimeout(
        (): void => {
          nextLetters[index].className = 'letter in'
        },
        600 + index * 40
      )
    }

    function changeWord(): void {
      const current = wordArray[currentWord]
      const next = currentWord === wordArray.length - 1 ? wordArray[0] : wordArray[currentWord + 1]
      if (!current || !next) {
        return
      }

      for (let i = 0; i < current.length; i++) {
        animateLetterOut(current, i)
      }

      for (let i = 0; i < next.length; i++) {
        next[i].className = 'letter behind'
        if (next?.[0]?.parentElement?.style) {
          next[0].parentElement.style.opacity = '1'
        }
        animateLetterIn(next, i)
      }

      currentWord = currentWord === wordArray.length - 1 ? 0 : currentWord + 1
    }

    delayRef.current = window.setTimeout((): void => {
      changeWord()
      intervalRef.current = window.setInterval(changeWord, intervalMs)
    }, startDelayMs)

    return (): void => {
      hasBeenTriggered.current = false
      if (delayRef.current) {
        window.clearTimeout(delayRef.current)
        delayRef.current = undefined
      }
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = undefined
      }
    }
  }, [animationId, intervalMs, startDelayMs, wordsSignature])

  return (
    <div className={'text sticky'}>
      <p className={'wordWrapper'} data-text-animate-id={animationId} data-text-animate-signature={wordsSignature}>
        {wordEntries.map((entry) => (
          <span className={'text-animate-word'} key={entry.key}>
            {entry.value}
          </span>
        ))}
      </p>
    </div>
  )
}
