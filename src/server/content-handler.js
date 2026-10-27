import { createPrivateKey, createSign } from 'node:crypto'
import { defaultSiteContent, parseSiteContent } from '../content/siteContent.js'

const apiBase = 'https://api.github.com'
const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
const maxBodyBytes = 120_000

const json = (status, body, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { ...jsonHeaders, ...headers },
})

const settingsFrom = (env) => ({
  clientId: env.GITHUB_APP_CLIENT_ID?.trim(),
  privateKey: env.GITHUB_APP_PRIVATE_KEY?.trim().replace(/\\n/g, '\n'),
  owner: env.GITHUB_CONTENT_REPO_OWNER?.trim(),
  repo: env.GITHUB_CONTENT_REPO_NAME?.trim(),
  branch: env.GITHUB_CONTENT_BRANCH?.trim() || 'site-content',
  path: env.GITHUB_CONTENT_PATH?.trim() || 'content/site-content.json',
})

const isConfigured = (settings) => Boolean(
  settings.clientId && settings.privateKey && settings.owner && settings.repo,
)

const githubHeaders = (token) => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'User-Agent': 'access-scotland-content-editor',
  'X-GitHub-Api-Version': '2022-11-28',
})

const githubJson = async (fetchImpl, url, options) => {
  const response = await fetchImpl(url, options)
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    const error = new Error(`GitHub returned ${response.status}.`)
    error.status = response.status
    throw error
  }
  return payload
}

const appJwt = (settings) => {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iat: now - 60, exp: now + 540, iss: settings.clientId })}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  signer.end()
  return `${unsigned}.${signer.sign(createPrivateKey(settings.privateKey)).toString('base64url')}`
}

const repoUrl = (settings) => `${apiBase}/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}`
const contentUrl = (settings) => `${repoUrl(settings)}/contents/${settings.path.split('/').map(encodeURIComponent).join('/')}`

const installationToken = async (settings, fetchImpl) => {
  const appToken = appJwt(settings)
  const installation = await githubJson(fetchImpl, `${repoUrl(settings)}/installation`, {
    headers: githubHeaders(appToken),
  })
  const token = await githubJson(fetchImpl, `${apiBase}/app/installations/${installation.id}/access_tokens`, {
    method: 'POST',
    headers: githubHeaders(appToken),
  })
  return token.token
}

const readFile = async (settings, fetchImpl, token) => {
  try {
    const file = await githubJson(fetchImpl, `${contentUrl(settings)}?ref=${encodeURIComponent(settings.branch)}`, {
      headers: githubHeaders(token),
    })
    if (file.type !== 'file' || file.encoding !== 'base64') throw new Error('Unexpected content file.')
    return {
      content: parseSiteContent(JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'))),
      revision: file.sha,
    }
  } catch (error) {
    if (error.status === 404) return { content: structuredClone(defaultSiteContent), revision: null }
    throw error
  }
}

export const handleContentRequest = async (request, { env = process.env, fetchImpl = fetch } = {}) => {
  if (request.method !== 'GET') return json(405, { error: 'Method not allowed.' }, { Allow: 'GET' })
  const settings = settingsFrom(env)
  if (!isConfigured(settings)) {
    return json(200, { content: defaultSiteContent, revision: null, persistenceConfigured: false })
  }

  try {
    const token = await installationToken(settings, fetchImpl)
    const result = await readFile(settings, fetchImpl, token)
    return json(200, { ...result, persistenceConfigured: true })
  } catch (error) {
    console.error('Unable to read live site content', error)
    return json(502, { error: 'Live site content is temporarily unavailable.' })
  }
}

export const handleAdminContentRequest = async (
  request,
  getUser,
  { env = process.env, fetchImpl = fetch } = {},
) => {
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed.' }, { Allow: 'POST' })

  const { authorizeAdmin } = await import('./admin-auth.js')
  const access = await authorizeAdmin(getUser)
  if (access.status !== 200) return json(access.status, { error: 'Admin access required.' })

  const origin = request.headers.get('Origin')
  if (origin && origin !== new URL(request.url).origin) {
    return json(403, { error: 'Cross-site edits are not allowed.' })
  }
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) {
    return json(415, { error: 'Send JSON content.' })
  }

  const settings = settingsFrom(env)
  if (!isConfigured(settings)) {
    return json(503, { error: 'GitHub content storage is not configured yet.' })
  }

  let content
  let revision
  try {
    const body = await request.text()
    if (Buffer.byteLength(body) > maxBodyBytes) return json(413, { error: 'The draft is too large.' })
    const payload = JSON.parse(body)
    content = parseSiteContent(payload.content, { strict: true })
    revision = payload.revision
    if (revision !== null && typeof revision !== 'string') throw new Error('Invalid content revision.')
  } catch (error) {
    return json(400, { error: error instanceof Error ? error.message : 'Invalid content.' })
  }

  try {
    const token = await installationToken(settings, fetchImpl)
    const current = await readFile(settings, fetchImpl, token)
    if (current.revision !== revision) {
      return json(409, { error: 'Someone else published changes. Refresh the editor before saving.' })
    }

    const actor = (access.user.email || 'admin').slice(0, 80)
    const result = await githubJson(fetchImpl, contentUrl(settings), {
      method: 'PUT',
      headers: { ...githubHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Update Access Scotland site copy (${actor})`,
        branch: settings.branch,
        content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
        ...(current.revision ? { sha: current.revision } : {}),
      }),
    })
    return json(200, { content, revision: result.content.sha })
  } catch (error) {
    if (error.status === 409) {
      return json(409, { error: 'Someone else published changes. Refresh the editor before saving.' })
    }
    console.error('Unable to save live site content', error)
    return json(502, { error: 'The edit could not be saved to GitHub. Please try again.' })
  }
}
