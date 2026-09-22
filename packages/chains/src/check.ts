import { validateChainConfiguration } from '@yearn/chains/validation'

const errors = validateChainConfiguration()
if (errors.length) {
  errors.forEach((error) => {
    console.error(error)
  })
  process.exitCode = 1
} else {
  console.info('Chain registry and app profiles are consistent (offline configuration check).')
}
