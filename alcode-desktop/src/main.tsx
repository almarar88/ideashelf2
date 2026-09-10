import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import Quick from './Quick'
import './theme.css'

/** التوجيه بالـ hash: النافذة الرئيسية على #/ والشريط السريع على #/quick. */
const isQuick = window.location.hash.startsWith('#/quick')

createRoot(document.getElementById('root')!).render(
  <StrictMode>{isQuick ? <Quick /> : <App />}</StrictMode>,
)
