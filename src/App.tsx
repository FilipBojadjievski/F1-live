import { NavLink, Route, Routes } from 'react-router'
import RacesPage from './pages/RacesPage'
import ReplayPage from './pages/ReplayPage'
import StandingsPage from './pages/StandingsPage'

export default function App() {
  return (
    <>
      <nav className="top-nav">
        <NavLink to="/">Standings</NavLink>
        <NavLink to="/races">Races</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<StandingsPage />} />
          <Route path="/races" element={<RacesPage />} />
          <Route path="/replay/:round" element={<ReplayPage />} />
        </Routes>
      </main>
    </>
  )
}
