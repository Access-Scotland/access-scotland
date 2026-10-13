import { useEffect, useRef, useState } from 'react'

const TURNSTILE_SCRIPT_SRC =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
const TURNSTILE_SITE_KEY = String(
  import.meta.env.VITE_TURNSTILE_SITE_KEY || '',
).trim()

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  organization: '',
  message: '',
}

function ContactForm() {
  const turnstileContainer = useRef(null)
  const turnstileWidgetId = useRef(null)
  const [formData, setFormData] = useState(emptyForm)
  const [website, setWebsite] = useState('')
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileError, setTurnstileError] = useState('')
  const [status, setStatus] = useState('idle')
  const [feedback, setFeedback] = useState(
    'We typically respond within two business days.',
  )

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !turnstileContainer.current) {
      return undefined
    }

    let isCancelled = false
    let script = null

    const renderTurnstile = () => {
      if (
        isCancelled ||
        !turnstileContainer.current ||
        !window.turnstile ||
        turnstileWidgetId.current
      ) {
        return
      }

      turnstileWidgetId.current = window.turnstile.render(
        turnstileContainer.current,
        {
          sitekey: TURNSTILE_SITE_KEY,
          action: 'contact',
          theme: 'light',
          callback: (token) => {
            setTurnstileToken(token)
            setTurnstileError('')
          },
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': (errorCode) => {
            setTurnstileToken('')
            setTurnstileError(
              `Security check unavailable (Cloudflare error ${errorCode}). Please refresh the page and try again.`,
            )
            return true
          },
        },
      )
    }

    if (window.turnstile) {
      renderTurnstile()
    } else {
      script = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`)

      if (!script) {
        script = document.createElement('script')
        script.src = TURNSTILE_SCRIPT_SRC
        script.async = true
        script.defer = true
        document.head.appendChild(script)
      }

      script.addEventListener('load', renderTurnstile)
    }

    return () => {
      isCancelled = true
      script?.removeEventListener('load', renderTurnstile)

      if (turnstileWidgetId.current) {
        window.turnstile?.remove?.(turnstileWidgetId.current)
        turnstileWidgetId.current = null
      }
    }
  }, [])

  const resetTurnstile = () => {
    setTurnstileToken('')

    if (turnstileWidgetId.current) {
      window.turnstile?.reset(turnstileWidgetId.current)
    }
  }

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('submitting')
    setFeedback('Sending your message...')

    try {
      if (TURNSTILE_SITE_KEY && !turnstileToken) {
        throw new Error('Please complete the verification before sending.')
      }

      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          website,
          turnstileToken,
        }),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(
          result?.error || 'We could not send your message. Please try again.',
        )
      }

      setFormData(emptyForm)
      setWebsite('')
      setStatus('success')
      setFeedback('Message sent. Thank you for contacting Access Scotland.')
    } catch (error) {
      setStatus('error')
      setFeedback(
        error instanceof Error
          ? error.message
          : 'We could not send your message. Please try again.',
      )
    } finally {
      resetTurnstile()
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div className="contact-form__row">
        <div className="contact-form__field">
          <label htmlFor="contact-name">Your name *</label>
          <input
            id="contact-name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            maxLength={100}
            autoComplete="name"
            required
          />
        </div>

        <div className="contact-form__field">
          <label htmlFor="contact-email">Email address *</label>
          <input
            id="contact-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            maxLength={254}
            autoComplete="email"
            required
          />
        </div>
      </div>

      <div className="contact-form__row">
        <div className="contact-form__field">
          <label htmlFor="contact-phone">Phone number</label>
          <input
            id="contact-phone"
            name="phone"
            type="tel"
            value={formData.phone}
            onChange={handleChange}
            maxLength={40}
            autoComplete="tel"
          />
        </div>

        <div className="contact-form__field">
          <label htmlFor="contact-organization">Church or organization</label>
          <input
            id="contact-organization"
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            maxLength={150}
            autoComplete="organization"
          />
        </div>
      </div>

      <div className="contact-form__field">
        <label htmlFor="contact-message">How can we help? *</label>
        <textarea
          id="contact-message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          maxLength={3000}
          rows={5}
          required
        ></textarea>
      </div>

      {TURNSTILE_SITE_KEY ? (
        <>
          <div className="turnstile-shell" ref={turnstileContainer}></div>
          {turnstileError ? (
            <p className="form-status form-status--error" role="alert">
              {turnstileError}
            </p>
          ) : null}
        </>
      ) : null}

      <button
        type="submit"
        className="button button--solid"
        disabled={status === 'submitting'}
      >
        {status === 'submitting' ? 'Sending...' : 'Send message'}
      </button>

      <p
        className={`form-status form-status--${status}`}
        role="status"
        aria-live="polite"
      >
        {feedback}
      </p>
    </form>
  )
}

export default ContactForm
