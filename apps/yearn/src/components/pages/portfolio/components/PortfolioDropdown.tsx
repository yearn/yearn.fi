import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from '@headlessui/react'
import { useThemePreference } from '@hooks/useThemePreference'
import { CompactActionButton } from '@shared/components/CompactActionButton'
import { IconCheck } from '@shared/icons/IconCheck'
import { IconChevron } from '@shared/icons/IconChevron'
import { cl } from '@shared/utils'
import { getDropdownStyles } from '@yearn/site-header/DropdownPanel'
import type { ReactNode } from 'react'

type TPortfolioDropdownProps<TValue extends string> = {
  label: string
  ariaLabel?: string
  value: TValue
  onChange: (value: TValue) => void
  groups: { label?: string; options: { value: TValue; label: ReactNode }[] }[]
  align?: 'start' | 'end'
  buttonClassName?: string
}

export function PortfolioDropdown<TValue extends string>({
  label,
  ariaLabel,
  value,
  onChange,
  groups,
  align = 'end',
  buttonClassName = 'max-w-52'
}: TPortfolioDropdownProps<TValue>) {
  const isDark = useThemePreference() !== 'light'
  const styles = getDropdownStyles(isDark)

  return (
    <Listbox value={value} onChange={onChange}>
      <ListboxButton as={CompactActionButton} aria-label={ariaLabel} className={buttonClassName}>
        <span className="min-w-0 truncate">{label}</span>
        <IconChevron className="size-4 shrink-0 transition-transform motion-reduce:transition-none group-data-open:rotate-180" />
      </ListboxButton>
      <ListboxOptions
        anchor={{ to: `bottom ${align}`, gap: 8, padding: 16 }}
        modal={false}
        className={cl(
          'z-100 flex max-h-72 w-max min-w-(--button-width) max-w-[min(18rem,calc(100vw-2rem))]! flex-col gap-3 overflow-auto shadow-xl outline-none scrollbar-themed',
          styles.panel
        )}
      >
        {groups.map(({ label: group, options }) => (
          <div key={group ?? 'ungrouped'} role={group ? 'group' : undefined} aria-label={group}>
            {group ? (
              <p aria-hidden="true" className={cl('mb-3', styles.heading)}>
                {group}
              </p>
            ) : null}
            {options.map((option) => (
              <ListboxOption
                key={option.value}
                value={option.value}
                className={cl(
                  'group cursor-pointer justify-between gap-2',
                  styles.item,
                  isDark ? 'data-focus:bg-white/10' : 'data-focus:bg-neutral-100'
                )}
              >
                <span className={cl('min-w-0 wrap-anywhere pl-1', styles.itemLabel)}>{option.label}</span>
                <IconCheck
                  className="invisible size-4 shrink-0 text-primary group-data-selected:visible"
                  aria-hidden="true"
                />
              </ListboxOption>
            ))}
          </div>
        ))}
      </ListboxOptions>
    </Listbox>
  )
}
