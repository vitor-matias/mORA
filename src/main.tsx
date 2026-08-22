import { StrictMode, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route } from "react-router-dom"
import './index.css'

import { Layout } from './components/layout/Layout'
import Home from './pages/Home'
import Rosary from './pages/Rosary'
import Liturgy from './pages/Liturgy'
import LiturgiaHoras from './pages/LiturgiaHoras'
import Profile from './pages/Profile'
import LiturgicalDirectory from './pages/LiturgicalDirectory'
import Palavra from './pages/Palavra'

// The three text libraries carry the whole corpus — a few hundred prayers,
// chaplets and hymns — and none of them is on the path a daily visit takes.
// Splitting them keeps that weight out of the first load.
const Devocionario = lazy(() => import('./pages/Devocionario'))
const Chaplets = lazy(() => import('./pages/Chaplets'))
const Canticos = lazy(() => import('./pages/Canticos'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="terco" element={<Rosary />} />
          <Route path="liturgia" element={<Liturgy />} />
          <Route path="liturgia-horas" element={<LiturgiaHoras />} />
          <Route path="diretorio" element={<LiturgicalDirectory />} />
          <Route path="palavra" element={<Palavra />} />
          {/* Optional segment: one component serves both the index and a
              single prayer, so searching, filtering and scrolling survive
              opening a prayer and coming back. */}
          <Route path="devocionario/:prayerId?" element={<Devocionario />} />
          {/* Same shape: the index and one chaplet share a route. */}
          <Route path="coroas/:chapletId?" element={<Chaplets />} />
          <Route path="canticos" element={<Canticos />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
