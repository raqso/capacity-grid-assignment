import { CapacityGrid } from '../CapacityGrid'

const INITIAL_FROM = '2025-12-29'
const INITIAL_TO = '2026-01-16'

export function App() {
  return (
    <main>
      <h1>Team capacity</h1>
      <CapacityGrid from={INITIAL_FROM} to={INITIAL_TO} />
    </main>
  )
}
