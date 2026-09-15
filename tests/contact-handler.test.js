import assert from 'node:assert/strict'
import test from 'node:test'
import { handleContactRequest } from '../src/server/contact-handler.js'

const makeRequest = (payload, ip = '203.0.113.10') =>
  new Request('https://accessscotland.com/api/contact', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(payload),
  })

const basePayload = {
  name: 'Jamie Fraser',
  email: 'jamie@example.com',
  phone: '555-0100',
  organization: 'Example Church',
  message: 'I would like to learn more about a mission partnership.',
  website: '',
  turnstileToken: '',
}

test('honeypot submissions return success without sending email', async () => {
  const originalFetch = globalThis.fetch
  let fetchCalled = false
  globalThis.fetch = async () => {
    fetchCalled = true
    throw new Error('fetch should not run')
  }

  try {
    const response = await handleContactRequest(
      makeRequest({ ...basePayload, website: 'spam.example' }),
      { env: {} },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(fetchCalled, false)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('required fields are validated server-side', async () => {
  const response = await handleContactRequest(
    makeRequest({ ...basePayload, name: '' }, '203.0.113.11'),
    { env: { CONTACT_RATE_LIMIT_PREFIX: 'test-required' } },
  )

  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), {
    error: 'Please complete all required fields.',
  })
})

test('valid submissions are delivered through Resend', async () => {
  const originalFetch = globalThis.fetch
  let resendRequest
  globalThis.fetch = async (url, options) => {
    resendRequest = { url, options }
    return Response.json({ id: 'email_123' })
  }

  try {
    const response = await handleContactRequest(
      makeRequest(basePayload, '203.0.113.12'),
      {
        env: {
          CONTACT_RATE_LIMIT_PREFIX: 'test-delivery',
          RESEND_API_KEY: 're_test',
          RESEND_FROM_EMAIL: 'Access Scotland <contact@accessscotland.com>',
          CONTACT_RECIPIENT_EMAILS:
            'jonathan@accessscotland.com,tony@accessscotland.com',
        },
      },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
    assert.equal(resendRequest.url, 'https://api.resend.com/emails')
    assert.equal(resendRequest.options.headers.Authorization, 'Bearer re_test')

    const email = JSON.parse(resendRequest.options.body)
    assert.deepEqual(email.to, [
      'jonathan@accessscotland.com',
      'tony@accessscotland.com',
    ])
    assert.equal(email.reply_to, basePayload.email)
    assert.match(email.text, /Example Church/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Turnstile hostname and action are verified before email delivery', async () => {
  const originalFetch = globalThis.fetch
  let callCount = 0
  globalThis.fetch = async () => {
    callCount += 1
    return Response.json({
      success: true,
      hostname: 'attacker.example',
      action: 'contact',
    })
  }

  try {
    const response = await handleContactRequest(
      makeRequest(
        { ...basePayload, turnstileToken: 'valid-looking-token' },
        '203.0.113.13',
      ),
      {
        env: {
          CONTACT_RATE_LIMIT_PREFIX: 'test-turnstile',
          TURNSTILE_SECRET_KEY: 'turnstile-secret',
          TURNSTILE_EXPECTED_HOSTNAMES: 'accessscotland.com',
          TURNSTILE_EXPECTED_ACTION: 'contact',
          CONTACT_TURNSTILE_REQUIRED: 'true',
          RESEND_API_KEY: 're_test',
          RESEND_FROM_EMAIL: 'Access Scotland <contact@accessscotland.com>',
          CONTACT_RECIPIENT_EMAILS: 'jonathan@accessscotland.com',
        },
      },
    )

    assert.equal(response.status, 400)
    assert.deepEqual(await response.json(), {
      error: 'Please complete the verification and try again.',
    })
    assert.equal(callCount, 1)
  } finally {
    globalThis.fetch = originalFetch
  }
})
