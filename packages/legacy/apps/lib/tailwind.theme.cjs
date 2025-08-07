const lightTheme = {
  /* 🔵 - Yearn Finance ******************************************************
   **	These are the colors you will use the most and will make up the majority
   **	of your UI. Use them for most of your text, backgrounds, and borders,
   **	as well as for things like secondary buttons and links.
   **************************************************************************/
  '--color-neutral-0': '0 0% 100%',
  '--color-neutral-100': '220 50% 98%',
  '--color-neutral-200': '220 47% 97%',
  '--color-neutral-300': '220 100% 94%',
  '--color-neutral-400': '220 27% 85%',
  '--color-neutral-500': '220 22% 36%',
  '--color-neutral-600': '220 22% 25%',
  '--color-neutral-700': '220 100% 14%',
  '--color-neutral-800': '0 0% 8%',
  '--color-neutral-900': '0 0% 0%',

  /* 🔵 - Yearn Finance ******************************************************
   **	These are the splashes of color that should appear the most in your UI,
   **	and are the ones that determine the overall "look" of the site. Use
   **	these for things like primary actions, links, navigation items, icons,
   **	accent borders, or text you want to emphasize.
   **************************************************************************/
  '--color-primary-100': '220 100% 94%',
  '--color-primary-200': '220 81% 88%',
  '--color-primary-500': '220 95% 50%',
  '--color-primary-600': '220 100% 44%',
  '--color-accent-500': '220 95% 50%',
  '--color-accent-600': '220 100% 44%',

  /* 🔵 - Yearn Finance ******************************************************
   **	These colors should be used fairly conservatively throughout your UI to
   **	avoid overpowering your primary colors. Use them when you need an
   **	element to stand out, or to reinforce things like error states or
   **	positive trends with the appropriate semantic color.
   **************************************************************************/
  '--color-yellow-900': '32 100% 45%',
  '--color-yellow-300': '32 100% 95%',
  '--color-yellow-200': '32 100% 90%',
  '--color-pink-900': '328 100% 45%',
  '--color-pink-300': '328 100% 95%',
  '--color-pink-200': '328 100% 90%',
  '--color-red-900': '0 100% 45%',
  '--color-red-300': '0 100% 95%',
  '--color-red-200': '0 100% 90%'
}
const darkTheme = {
  /* 🔵 - Yearn Finance ******************************************************
   **	These are the colors you will use the most and will make up the majority
   **	of your UI. Use them for most of your text, backgrounds, and borders,
   **	as well as for things like secondary buttons and links.
   **************************************************************************/
  '--color-neutral-0': '0 0% 0%',
  '--color-neutral-100': '0 0% 10%',
  '--color-neutral-200': '0 0% 8%',
  '--color-neutral-300': '0 0% 15%',
  '--color-neutral-400': '0 0% 66%',
  '--color-neutral-500': '0 0% 100%',
  '--color-neutral-600': '0 0% 13%',
  '--color-neutral-700': '0 0% 100%',
  '--color-neutral-800': '0 0% 8%',
  '--color-neutral-900': '0 0% 100%',

  /* 🔵 - Yearn Finance ******************************************************
   **	These are the splashes of color that should appear the most in your UI,
   **	and are the ones that determine the overall "look" of the site. Use
   **	these for things like primary actions, links, navigation items, icons,
   **	accent borders, or text you want to emphasize.
   **************************************************************************/
  '--color-primary-100': '0 0% 15%',
  '--color-primary-200': '0 0% 13%',
  '--color-primary-500': '0 0% 100%',
  '--color-primary-600': '0 0% 90%',
  '--color-accent-500': '220 95% 50%',
  '--color-accent-600': '220 100% 44%',

  /* 🔵 - Yearn Finance ******************************************************
   **	These colors should be used fairly conservatively throughout your UI to
   **	avoid overpowering your primary colors. Use them when you need an
   **	element to stand out, or to reinforce things like error states or
   **	positive trends with the appropriate semantic color.
   **************************************************************************/
  '--color-yellow-900': '32 100% 45%',
  '--color-yellow-300': '32 100% 95%',
  '--color-yellow-200': '32 100% 90%',
  '--color-pink-900': '328 100% 45%',
  '--color-pink-300': '328 100% 95%',
  '--color-pink-200': '328 100% 90%',
  '--color-red-900': '0 100% 45%',
  '--color-red-300': '0 100% 95%',
  '--color-red-200': '0 100% 90%'
}
const colors = {
  ...lightTheme, //default

  '@media (prefers-color-scheme: light)': {
    '& body[data-theme="system-prefs"]': {
      ...lightTheme
    }
  },
  '@media (prefers-color-scheme: dark)': {
    '& body[data-theme="system-prefs"]': {
      ...darkTheme
    }
  },
  '& body[data-theme="light"]': {
    ...lightTheme
  },
  '& body[data-theme="dark"]': {
    ...darkTheme
  }
}

//Not implemented yet
const paddings = {
  '--padding-none': '0rem', //0px | p-0
  '--padding-tightest': '0.125rem', //2px | p-0.5
  '--padding-tighter': '0.25rem', //4px | p-1
  '--padding-tight': '0.5rem', //8px | p-2
  '--padding-normal': '1rem', //16px | p-4
  '--padding-wide': '1.5rem', //24px | p-6
  '--padding-wider': '2rem', //32px | p-8
  '--padding-widest': '3rem' //48px | p-12
}

module.exports = { colors, paddings }
