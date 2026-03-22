import { writeFileSync } from 'fs'

// Capture console.log
const logs: string[] = []
const originalLog = console.log
console.log = (...args: any[]) => {
  logs.push(args.join(' '))
  originalLog(...args)
}

// Import and run the test
import('./test-solana').catch((e) => {
  logs.push(`ERROR: ${e.message}`)
})

// Write results after a short delay
setTimeout(() => {
  writeFileSync('.test-output.txt', logs.join('\n'), 'utf-8')
  process.exit(0)
}, 5000)
