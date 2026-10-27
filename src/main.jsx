import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminRoute, { InlineAdminRoute } from './AdminRoute.jsx'

const isAdminPath = /^\/admin(?:\/|$)/.test(window.location.pathname)
const isIdentityCallback = /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/.test(
  window.location.hash,
)
const isAdminMode = new URLSearchParams(window.location.search).get('admin') === '1'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminPath || isIdentityCallback ? (
      <AdminRoute />
    ) : isAdminMode ? (
      <InlineAdminRoute />
    ) : (
      <App />
    )}
  </StrictMode>,
)
