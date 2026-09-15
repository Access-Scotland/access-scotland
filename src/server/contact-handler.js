import { createHash, randomUUID } from 'node:crypto'
import { isIP } from 'node:net'

const MAX_BODY_LENGTH = 20_000
const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const RESEND_EMAIL_URL = 'https://api.resend.com/emails'

const memoryCounters = new Map()
const memoryDuplicates = new Map()
let lastMemoryPrune = 0

const getEnvNumber = (env, key, fallback) => {
  const parsed = Number(env[key])
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const getConfig = (env) => ({
  requestIpMax: getEnvNumber(env, 'CONTACT_REQUEST_IP_MAX', 20),
  requestIpWindowSeconds: getEnvNumber(
    env,
    'CONTACT_REQUEST_IP_WINDOW_SECONDS',
    15 * 60,
  ),
  messageIpMax: getEnvNumber(env, 'CONTACT_RATE_LIMIT_IP_MAX', 3),
  messageIpWindowSeconds: getEnvNumber(
    env,
    'CONTACT_RATE_LIMIT_IP_WINDOW_SECONDS',
    60 * 60,
  ),
  emailMax: getEnvNumber(env, 'CONTACT_RATE_LIMIT_EMAIL_MAX', 2),
  emailWindowSeconds: getEnvNumber(
    env,
    'CONTACT_RATE_LIMIT_EMAIL_WINDOW_SECONDS',
    60 * 60,
  ),
  globalMax: getEnvNumber(env, 'CONTACT_RATE_LIMIT_GLOBAL_MAX', 50),
  globalWindowSeconds: getEnvNumber(
    env,
    'CONTACT_RATE_LIMIT_GLOBAL_WINDOW_SECONDS',
    24 * 60 * 60,
  ),
  duplicateWindowSeconds: getEnvNumber(
    env,
    'CONTACT_DUPLICATE_WINDOW_SECONDS',
    24 * 60 * 60,
  ),
  maxNameLength: getEnvNumber(env, 'CONTACT_MAX_NAME_LENGTH', 100),
  maxEmailLength: getEnvNumber(env, 'CONTACT_MAX_EMAIL_LENGTH', 254),
  maxPhoneLength: getEnvNumber(env, 'CONTACT_MAX_PHONE_LENGTH', 40),
  maxOrganizationLength: getEnvNumber(
    env,
    'CONTACT_MAX_ORGANIZATION_LENGTH',
    150,
  ),
  maxMessageLength: getEnvNumber(env, 'CONTACT_MAX_MESSAGE_LENGTH', 3000),
  maxUrls: getEnvNumber(env, 'CONTACT_MAX_URLS', 2),
  keyPrefix: env.CONTACT_RATE_LIMIT_PREFIX || 'access-scotland-contact',
})

const sendJson = (status, body, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json',
      ...headers,
    },
  })

const parsePayload = async (request) => {
  const body = await request.text()

  if (body.length > MAX_BODY_LENGTH) {
    throw new Error('Request body is too large.')
  }

  return JSON.parse(body || '{}')
}

const getString = (value) => (typeof value === 'string' ? value.trim() : '')
const parseCsv = (value) =>
  (value || '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim()
const hashValue = (value) =>
  createHash('sha256').update(value).digest('hex')
const makeKey = (config, ...parts) =>
  `${config.keyPrefix}:${parts.join(':')}`
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
const countUrls = (value) =>
  (value.match(/\b(?:https?:\/\/|www\.)\S+/gi) || []).length

const getClientIp = (request, fallbackIp) => {
  const forwardedIp = request.headers
    .get('x-forwarded-for')
    ?.split(',')[0]
    ?.trim()
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-real-ip') ||
    forwardedIp ||
    fallbackIp ||
    'unknown'

  return ip.replace(/^::ffff:/, '')
}

const pruneMemoryStore = () => {
  const now = Date.now()

  if (now - lastMemoryPrune < 60_000) {
    return
  }

  lastMemoryPrune = now
  memoryCounters.forEach((entry, entryKey) => {
    if (entry.resetAt <= now) memoryCounters.delete(entryKey)
  })
  memoryDuplicates.forEach((resetAt, entryKey) => {
    if (resetAt <= now) memoryDuplicates.delete(entryKey)
  })
}

const hasUpstashStore = (env) =>
  Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)

const runUpstashPipeline = async (env, commands) => {
  const restUrl = env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, '')
  const response = await fetch(`${restUrl}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })

  if (!response.ok) {
    throw new Error(`Rate-limit store returned ${response.status}.`)
  }

  const results = await response.json()
  const failed = results.find((result) => result.error)

  if (failed?.error) throw new Error(failed.error)
  return results
}

const incrementMemoryCounter = (counterKey, windowSeconds) => {
  pruneMemoryStore()
  const now = Date.now()
  const existing = memoryCounters.get(counterKey)

  if (!existing || existing.resetAt <= now) {
    memoryCounters.set(counterKey, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    })
    return { count: 1, resetSeconds: windowSeconds }
  }

  existing.count += 1
  return {
    count: existing.count,
    resetSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

const incrementCounter = async (env, counterKey, windowSeconds) => {
  if (!hasUpstashStore(env)) {
    return incrementMemoryCounter(counterKey, windowSeconds)
  }

  try {
    const results = await runUpstashPipeline(env, [
      ['INCR', counterKey],
      ['EXPIRE', counterKey, windowSeconds, 'NX'],
      ['TTL', counterKey],
    ])
    const ttl = Number(results[2]?.result || windowSeconds)

    return {
      count: Number(results[0]?.result || 0),
      resetSeconds: ttl > 0 ? ttl : windowSeconds,
    }
  } catch (error) {
    console.error('Rate-limit store failed; using memory instead.', error)
    return incrementMemoryCounter(counterKey, windowSeconds)
  }
}

const enforceRateLimits = async (env, rules) => {
  for (const rule of rules) {
    const result = await incrementCounter(env, rule.key, rule.windowSeconds)

    if (result.count > rule.max) {
      return {
        allowed: false,
        message: rule.message,
        retryAfter: result.resetSeconds,
      }
    }
  }

  return { allowed: true, message: '', retryAfter: 0 }
}

const reserveMemoryDuplicate = (duplicateKey, windowSeconds) => {
  pruneMemoryStore()
  const now = Date.now()
  const resetAt = memoryDuplicates.get(duplicateKey)

  if (resetAt && resetAt > now) return false
  memoryDuplicates.set(duplicateKey, now + windowSeconds * 1000)
  return true
}

const reserveDuplicate = async (env, duplicateKey, windowSeconds) => {
  if (!hasUpstashStore(env)) {
    return reserveMemoryDuplicate(duplicateKey, windowSeconds)
  }

  try {
    const results = await runUpstashPipeline(env, [
      ['SET', duplicateKey, '1', 'NX', 'EX', windowSeconds],
    ])
    return results[0]?.result === 'OK'
  } catch (error) {
    console.error('Duplicate store failed; using memory instead.', error)
    return reserveMemoryDuplicate(duplicateKey, windowSeconds)
  }
}

const releaseDuplicate = async (env, duplicateKey) => {
  memoryDuplicates.delete(duplicateKey)

  if (!hasUpstashStore(env)) return

  try {
    await runUpstashPipeline(env, [['DEL', duplicateKey]])
  } catch (error) {
    console.error('Could not release duplicate reservation.', error)
  }
}

const shouldRequireTurnstile = (env) =>
  env.CONTACT_TURNSTILE_REQUIRED === 'true' ||
  (Boolean(env.TURNSTILE_SECRET_KEY) &&
    env.CONTACT_TURNSTILE_REQUIRED !== 'false')

const validateTurnstile = async (env, token, ip) => {
  const secret = env.TURNSTILE_SECRET_KEY

  if (!secret && !shouldRequireTurnstile(env)) {
    return { valid: true, misconfigured: false }
  }

  if (!secret) return { valid: false, misconfigured: true }
  if (!token || token.length > 2048) {
    return { valid: false, misconfigured: false }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const body = new URLSearchParams({
      secret,
      response: token,
      idempotency_key: randomUUID(),
    })

    if (isIP(ip)) body.set('remoteip', ip)

    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    })
    const result = await response.json()
    const expectedHostnames = parseCsv(
      env.TURNSTILE_EXPECTED_HOSTNAMES ||
        env.TURNSTILE_EXPECTED_HOSTNAME,
    ).map((hostname) => hostname.toLowerCase())
    const expectedAction = env.TURNSTILE_EXPECTED_ACTION || 'contact'
    const actualHostname = result.hostname?.trim().toLowerCase()

    if (!response.ok || !result.success) {
      return {
        valid: false,
        misconfigured: false,
        errorCode: result['error-codes']?.[0] || `http-${response.status}`,
      }
    }

    if (
      expectedHostnames.length &&
      (!actualHostname || !expectedHostnames.includes(actualHostname))
    ) {
      return {
        valid: false,
        misconfigured: false,
        errorCode: 'hostname-mismatch',
      }
    }

    if (expectedAction && result.action !== expectedAction) {
      return {
        valid: false,
        misconfigured: false,
        errorCode: 'action-mismatch',
      }
    }

    return { valid: true, misconfigured: false }
  } catch (error) {
    console.error('Turnstile verification failed.', error)
    return { valid: false, misconfigured: false, errorCode: 'internal-error' }
  } finally {
    clearTimeout(timeout)
  }
}

const escapeHtml = (value) =>
  value.replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    return entities[character]
  })

const optionalValue = (value) => value || 'Not provided'

const validateFields = (config, fields) => {
  if (fields.name.length > config.maxNameLength) return 'Please shorten your name.'
  if (fields.email.length > config.maxEmailLength) {
    return 'Please enter a shorter email address.'
  }
  if (fields.phone.length > config.maxPhoneLength) {
    return 'Please enter a shorter phone number.'
  }
  if (fields.organization.length > config.maxOrganizationLength) {
    return 'Please shorten the church or organization name.'
  }
  if (fields.message.length > config.maxMessageLength) {
    return 'Please shorten your message.'
  }
  if (countUrls(fields.message) > config.maxUrls) {
    return 'Please remove some links from your message.'
  }
  return ''
}

export const handleContactRequest = async (request, options = {}) => {
  const env = options.env ?? process.env
  const config = getConfig(env)

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: { Allow: 'POST, OPTIONS' } })
  }
  if (request.method !== 'POST') {
    return sendJson(405, { error: 'Method not allowed.' }, { Allow: 'POST, OPTIONS' })
  }

  const ipHash = hashValue(getClientIp(request, options.remoteIp))
  let payload

  try {
    payload = await parsePayload(request)
  } catch {
    return sendJson(400, { error: 'Invalid contact form submission.' })
  }

  if (getString(payload.website)) {
    return sendJson(200, { ok: true })
  }

  const requestLimit = await enforceRateLimits(env, [
    {
      key: makeKey(config, 'request', 'ip', ipHash),
      max: config.requestIpMax,
      windowSeconds: config.requestIpWindowSeconds,
      message: 'Too many attempts. Please wait a few minutes and try again.',
    },
  ])

  if (!requestLimit.allowed) {
    return sendJson(
      429,
      { error: requestLimit.message },
      { 'Retry-After': String(requestLimit.retryAfter) },
    )
  }

  const fields = {
    name: getString(payload.name),
    email: getString(payload.email),
    phone: getString(payload.phone),
    organization: getString(payload.organization),
    message: getString(payload.message),
  }
  const normalizedEmail = fields.email.toLowerCase()

  if (!fields.name || !fields.email || !fields.message) {
    return sendJson(400, { error: 'Please complete all required fields.' })
  }
  if (!isValidEmail(fields.email)) {
    return sendJson(400, { error: 'Please enter a valid email address.' })
  }

  const validationError = validateFields(config, fields)
  if (validationError) return sendJson(400, { error: validationError })

  const turnstile = await validateTurnstile(
    env,
    getString(payload.turnstileToken),
    getClientIp(request, options.remoteIp),
  )

  if (turnstile.misconfigured) {
    return sendJson(500, { error: 'Form verification is not configured.' })
  }
  if (!turnstile.valid) {
    return sendJson(400, {
      error: 'Please complete the verification and try again.',
    })
  }

  const messageLimit = await enforceRateLimits(env, [
    {
      key: makeKey(config, 'message', 'ip', ipHash),
      max: config.messageIpMax,
      windowSeconds: config.messageIpWindowSeconds,
      message: 'Too many messages from this connection. Please try again later.',
    },
    {
      key: makeKey(config, 'message', 'email', hashValue(normalizedEmail)),
      max: config.emailMax,
      windowSeconds: config.emailWindowSeconds,
      message: 'Too many messages from this email address. Please try again later.',
    },
    {
      key: makeKey(config, 'message', 'global'),
      max: config.globalMax,
      windowSeconds: config.globalWindowSeconds,
      message: 'The contact form is temporarily busy. Please try again later.',
    },
  ])

  if (!messageLimit.allowed) {
    return sendJson(
      429,
      { error: messageLimit.message },
      { 'Retry-After': String(messageLimit.retryAfter) },
    )
  }

  const duplicateKey = makeKey(
    config,
    'duplicate',
    hashValue(
      [
        normalizedEmail,
        normalizeWhitespace(fields.message).toLowerCase(),
      ].join(':'),
    ),
  )

  if (!(await reserveDuplicate(env, duplicateKey, config.duplicateWindowSeconds))) {
    return sendJson(409, { error: 'This message was already sent recently.' })
  }

  const recipients = parseCsv(
    env.CONTACT_RECIPIENT_EMAILS || env.CONTACT_RECIPIENT_EMAIL,
  )
  if (!env.RESEND_API_KEY || !env.RESEND_FROM_EMAIL || !recipients.length) {
    await releaseDuplicate(env, duplicateKey)
    return sendJson(500, { error: 'Email delivery is not configured.' })
  }

  const submittedAt = new Date().toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: env.CONTACT_TIME_ZONE || 'America/New_York',
  })
  const text = [
    'New Access Scotland contact form submission',
    '',
    `Name: ${fields.name}`,
    `Email: ${fields.email}`,
    `Phone: ${optionalValue(fields.phone)}`,
    `Church or organization: ${optionalValue(fields.organization)}`,
    `Submitted: ${submittedAt}`,
    '',
    'Message:',
    fields.message,
  ].join('\n')
  const html = `
    <h2>New Access Scotland contact form submission</h2>
    <table style="border-collapse: collapse; width: 100%; max-width: 640px;">
      <tr><td style="padding: 8px; font-weight: 700;">Name</td><td style="padding: 8px;">${escapeHtml(fields.name)}</td></tr>
      <tr><td style="padding: 8px; font-weight: 700;">Email</td><td style="padding: 8px;">${escapeHtml(fields.email)}</td></tr>
      <tr><td style="padding: 8px; font-weight: 700;">Phone</td><td style="padding: 8px;">${escapeHtml(optionalValue(fields.phone))}</td></tr>
      <tr><td style="padding: 8px; font-weight: 700;">Church or organization</td><td style="padding: 8px;">${escapeHtml(optionalValue(fields.organization))}</td></tr>
      <tr><td style="padding: 8px; font-weight: 700;">Submitted</td><td style="padding: 8px;">${escapeHtml(submittedAt)}</td></tr>
    </table>
    <h3>Message</h3>
    <p style="white-space: pre-wrap;">${escapeHtml(fields.message)}</p>
  `

  try {
    const resendResponse = await fetch(RESEND_EMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'access-scotland/1.0',
      },
      body: JSON.stringify({
        from: env.RESEND_FROM_EMAIL,
        to: recipients,
        subject: `New website message from ${fields.name}`,
        html,
        text,
        reply_to: fields.email,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.json().catch(() => null)
      console.error('Resend delivery failed.', {
        status: resendResponse.status,
        error,
      })
      await releaseDuplicate(env, duplicateKey)
      return sendJson(502, {
        error: 'We could not send your message. Please try again later.',
      })
    }

    return sendJson(200, { ok: true })
  } catch (error) {
    console.error('Contact email failed.', error)
    await releaseDuplicate(env, duplicateKey)
    return sendJson(502, {
      error: 'We could not send your message. Please try again later.',
    })
  }
}
