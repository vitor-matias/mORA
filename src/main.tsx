import { StrictMode } from 'react'
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
          <Route path="perfil" element={<Profile />} />
        </Route>
      </Routes>
    </HashRouter>
  </StrictMode>,
)
