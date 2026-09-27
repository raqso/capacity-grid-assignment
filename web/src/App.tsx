import { CapacityGrid } from './CapacityGrid'

// Initial range the grid loads. The grid's own controls let users navigate.
const FROM = '2025-12-29'
const TO = '2026-01-16'

export function App() {
  return (
    <main>
      <h1>Team capacity</h1>
      <CapacityGrid from={FROM} to={TO} />
    </main>
  )
}
