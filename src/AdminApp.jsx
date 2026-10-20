import { useEffect, useState } from 'react'
import {
  acceptInvite,
  getUser,
  handleAuthCallback,
  login,
  logout,
  requestPasswordRecovery,
  updateUser,
} from '@netlify/identity'
import { brand } from './siteData'
import './AdminApp.css'

const authCallbackHash = /^#(confirmation_token|recovery_token|invite_token|email_change_token|access_token)=/.test(
  window.location.hash,
)
let callbackPromise

const checkAdminSession = async () => {
  await getUser()

  const response = await fetch('/api/admin/session', {
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })

  if (response.status === 401) return { view: 'login' }
  if (response.status === 403) return { view: 'forbidden' }
  if (!response.ok) throw new Error('We could not check admin access. Please try again.')
  if (!response.headers.get('Content-Type')?.includes('application/json')) {
    throw new Error('Admin sign in needs Netlify Identity on the deployed site.')
  }

  const data = await response.json()
  return { view: 'dashboard', user: data.user }
}

function AdminApp() {
  const [view, setView] = useState('loading')
  const [user, setUser] = useState(null)
  const [inviteToken, setInviteToken] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    document.title = 'Admin | Access Scotland'
    let cancelled = false

    const initialize = async () => {
      try {
        if (authCallbackHash) {
          callbackPromise ||= handleAuthCallback()
          let result

          try {
            result = await callbackPromise
          } finally {
            window.history.replaceState(null, '', '/admin')
          }

          if (cancelled) return

          if (result?.type === 'invite') {
            if (!result.token) throw new Error('This invitation link is incomplete.')
            setInviteToken(result.token)
            setView('invite')
            return
          }

          if (result?.type === 'recovery') {
            setView('recovery')
            return
          }
        }

        const session = await checkAdminSession()
        if (cancelled) return
        setView(session.view)
        setUser(session.user || null)
      } catch (error) {
        if (cancelled) return
        setView('login')
        setNotice({
          tone: 'error',
          text: error instanceof Error
            ? error.message
            : 'We could not open admin sign in. Please try again.',
        })
      }
    }

    initialize()
    return () => {
      cancelled = true
    }
  }, [])

  const applySession = (session) => {
    setView(session.view)
    setUser(session.user || null)
    setNotice(
      session.view === 'forbidden'
        ? {
            tone: 'error',
            text: 'This account is signed in but has not been given admin access.',
          }
        : null,
    )
  }

  const submitLogin = async (event) => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)

    try {
      await login(email.trim(), password)
      setPassword('')
      applySession(await checkAdminSession())
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'We could not sign you in.',
      })
    } finally {
      setBusy(false)
    }
  }

  const submitRecoveryRequest = async (event) => {
    event.preventDefault()
    setBusy(true)
    setNotice(null)

    try {
      await requestPasswordRecovery(email.trim())
      setView('login')
      setNotice({
        tone: 'success',
        text: 'If that address has an account, a reset link is on its way.',
      })
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error
          ? error.message
          : 'We could not send the reset link. Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const submitNewPassword = async (event) => {
    event.preventDefault()

    if (password !== confirmPassword) {
      setNotice({ tone: 'error', text: 'The passwords do not match.' })
      return
    }

    setBusy(true)
    setNotice(null)

    try {
      if (view === 'invite') {
        await acceptInvite(inviteToken, password)
      } else {
        await updateUser({ password })
      }

      setPassword('')
      setConfirmPassword('')
      applySession(await checkAdminSession())
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error
          ? error.message
          : 'We could not save your password. Please try again.',
      })
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    setNotice(null)

    try {
      await logout()
      setUser(null)
      setView('login')
      setEmail('')
      setPassword('')
    } catch (error) {
      setNotice({
        tone: 'error',
        text: error instanceof Error ? error.message : 'We could not sign you out.',
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="admin-page">
      <section className="admin-layout" aria-labelledby="admin-heading">
        <div
          className="admin-landscape"
          style={{ backgroundImage: `url(${brand.heroImage})` }}
        >
          <div className="admin-landscape__content">
            <a className="admin-brand" href="/" aria-label="Access Scotland home">
              <img src={brand.logo} alt="" />
              <span>Access Scotland</span>
            </a>
            <div className="admin-landscape__message">
              <p className="admin-kicker">Send / Seek / Serve</p>
              <p>Stories from Scotland, cared for by the people behind them.</p>
            </div>
          </div>
        </div>

        <div className="admin-panel">
          <a className="admin-back" href="/">← Back to the site</a>

          {view === 'loading' ? (
            <div className="admin-panel__body" role="status">
              <p className="admin-eyebrow">Access Scotland</p>
              <h1 id="admin-heading">Opening admin...</h1>
              <p>Checking your account.</p>
            </div>
          ) : null}

          {view === 'login' ? (
            <div className="admin-panel__body">
              <p className="admin-eyebrow">Private area</p>
              <h1 id="admin-heading">Welcome back.</h1>
              <p>Sign in with the account invited by Access Scotland.</p>

              <form className="admin-form" onSubmit={submitLogin}>
                <label htmlFor="admin-email">Email address</label>
                <input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  required
                />
                <label htmlFor="admin-password">Password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button className="admin-button" type="submit" disabled={busy}>
                  {busy ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
              <button
                className="admin-text-button"
                type="button"
                onClick={() => {
                  setView('forgot')
                  setNotice(null)
                }}
              >
                Forgot your password?
              </button>
            </div>
          ) : null}

          {view === 'forgot' ? (
            <div className="admin-panel__body">
              <p className="admin-eyebrow">Account recovery</p>
              <h1 id="admin-heading">Reset your password.</h1>
              <p>We will email a reset link to your invited address.</p>
              <form className="admin-form" onSubmit={submitRecoveryRequest}>
                <label htmlFor="recovery-email">Email address</label>
                <input
                  id="recovery-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                />
                <button className="admin-button" type="submit" disabled={busy}>
                  {busy ? 'Sending...' : 'Send reset link'}
                </button>
              </form>
              <button
                className="admin-text-button"
                type="button"
                onClick={() => {
                  setView('login')
                  setNotice(null)
                }}
              >
                Return to sign in
              </button>
            </div>
          ) : null}

          {view === 'invite' || view === 'recovery' ? (
            <div className="admin-panel__body">
              <p className="admin-eyebrow">
                {view === 'invite' ? 'Your invitation' : 'Account recovery'}
              </p>
              <h1 id="admin-heading">
                {view === 'invite' ? 'Set your password.' : 'Choose a new password.'}
              </h1>
              <p>Use at least 12 characters to protect your admin account.</p>
              <form className="admin-form" onSubmit={submitNewPassword}>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
                <button className="admin-button" type="submit" disabled={busy}>
                  {busy ? 'Saving...' : 'Save password'}
                </button>
              </form>
            </div>
          ) : null}

          {view === 'dashboard' ? (
            <div className="admin-panel__body">
              <p className="admin-eyebrow">Admin access active</p>
              <h1 id="admin-heading">You are signed in.</h1>
              <p className="admin-account">{user?.email}</p>
              <div className="admin-next-step">
                <span className="admin-next-step__number">01</span>
                <div>
                  <strong>Photo management comes next</strong>
                  <p>
                    This is the secure starting point for managing albums and
                    site images in a later phase.
                  </p>
                </div>
              </div>
              <button
                className="admin-button admin-button--outline"
                type="button"
                onClick={signOut}
                disabled={busy}
              >
                {busy ? 'Signing out...' : 'Sign out'}
              </button>
            </div>
          ) : null}

          {view === 'forbidden' ? (
            <div className="admin-panel__body">
              <p className="admin-eyebrow">Access limited</p>
              <h1 id="admin-heading">Admin access required.</h1>
              <p>Ask the site owner to assign the admin role to this account.</p>
              <button
                className="admin-button admin-button--outline"
                type="button"
                onClick={signOut}
                disabled={busy}
              >
                {busy ? 'Signing out...' : 'Sign out and switch account'}
              </button>
            </div>
          ) : null}

          {notice ? (
            <p className={`admin-notice admin-notice--${notice.tone}`} role="alert">
              {notice.text}
            </p>
          ) : null}
          <p className="admin-panel__footnote">Access Scotland · Admin</p>
        </div>
      </section>
    </main>
  )
}

export default AdminApp
