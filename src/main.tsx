import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import './index.css'

import { init as initNostrLogin } from 'nostr-login'
import { Layout } from './components/layout/Layout'

initNostrLogin({
  theme: 'default',
});
import Home from './pages/Home'
import Rosary from './pages/Rosary'
import Liturgy from './pages/Liturgy'
import LiturgiaHoras from './pages/LiturgiaHoras'
import Profile from './pages/Profile'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="terco" element={<Rosary />} />
          <Route path="liturgia" element={<Liturgy />} />
          <Route path="liturgia-horas" element={<LiturgiaHoras />} />
          <Route path="perfil" element={<Profile />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
