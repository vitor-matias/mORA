import '@babel/polyfill'
import 'core-js/stable'
import 'regenerator-runtime/runtime'
import 'whatwg-fetch'

// Polyfill check and setup for KaiOS/old browsers
if (typeof Object.assign !== 'function') {
  Object.defineProperty(Object, 'assign', {
    value: function assign(target: any, ...sources: any[]) {
      if (target == null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }
      const to = Object(target);
      for (let index = 0; index < sources.length; index++) {
        const nextSource = sources[index];
        if (nextSource != null) {
          for (const nextKey in nextSource) {
            if (Object.prototype.hasOwnProperty.call(nextSource, nextKey)) {
              to[nextKey] = nextSource[nextKey];
            }
          }
        }
      }
      return to;
    },
    writable: true,
    configurable: true,
  });
}

// Ensure Promise exists
if (typeof Promise === 'undefined') {
  console.error('Critical: Promise not available - app will not function');
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from "react-router-dom"
import './index.css'

import { Layout } from './components/layout/Layout'
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
