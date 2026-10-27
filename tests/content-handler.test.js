import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { defaultSiteContent } from '../src/content/siteContent.js'
import { handleAdminContentRequest, handleContentRequest } from '../src/server/content-handler.js'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const env = {
  GITHUB_APP_CLIENT_ID: 'Iv1_test',
  GITHUB_APP_PRIVATE_KEY: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  GITHUB_CONTENT_REPO_OWNER: 'client',
  GITHUB_CONTENT_REPO_NAME: 'access-scotland',
}
const admin = async () => ({ email: 'editor@example.com', roles: ['admin'] })

const github = (file = null) => {
  const calls = []
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options })
    if (url.endsWith('/installation')) return Response.json({ id: 12 })
    if (url.endsWith('/access_tokens')) return Response.json({ token: 'installation-token' })
    if (url.includes('/contents/') && options.method === 'PUT') {
      return Response.json({ content: { sha: 'new-revision' } })
    }
    if (url.includes('/contents/') && file) return Response.json(file)
    return Response.json({ message: 'Not Found' }, { status: 404 })
  }
  return { calls, fetchImpl }
}

const saveRequest = (body, headers = {}) => new Request('https://example.com/api/admin/content', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: 'https://example.com', ...headers },
  body: JSON.stringify(body),
})

test('public content falls back to bundled copy before GitHub setup', async () => {
  const response = await handleContentRequest(new Request('https://example.com/api/content'), { env: {} })
  const payload = await response.json()
  assert.equal(response.status, 200)
  assert.equal(payload.persistenceConfigured, false)
  assert.equal(payload.content.about.title, defaultSiteContent.about.title)
})

test('only admins can publish and cross-site requests are rejected', async () => {
  const store = github()
  const request = saveRequest({ content: defaultSiteContent, revision: null })
  assert.equal((await handleAdminContentRequest(request, async () => null, { env, fetchImpl: store.fetchImpl })).status, 401)
  assert.equal((await handleAdminContentRequest(saveRequest({ content: defaultSiteContent, revision: null }), async () => ({ roles: [] }), { env, fetchImpl: store.fetchImpl })).status, 403)
  assert.equal((await handleAdminContentRequest(saveRequest({ content: defaultSiteContent, revision: null }, { Origin: 'https://evil.example' }), admin, { env, fetchImpl: store.fetchImpl })).status, 403)
  assert.equal(store.calls.length, 0)
})

test('admin edits create the content file on the dedicated branch', async () => {
  const store = github()
  const request = saveRequest({ content: defaultSiteContent, revision: null })
  const response = await handleAdminContentRequest(request, admin, { env, fetchImpl: store.fetchImpl })
  assert.equal(response.status, 200)
  assert.equal((await response.json()).revision, 'new-revision')
  const write = store.calls.find(({ options }) => options.method === 'PUT')
  assert.equal(JSON.parse(write.options.body).branch, 'site-content')
  assert.equal(write.options.headers.Authorization, 'Bearer installation-token')
})

test('stale drafts do not overwrite another admin edit', async () => {
  const file = {
    type: 'file',
    encoding: 'base64',
    sha: 'latest-revision',
    content: Buffer.from(JSON.stringify(defaultSiteContent)).toString('base64'),
  }
  const store = github(file)
  const response = await handleAdminContentRequest(
    saveRequest({ content: defaultSiteContent, revision: 'old-revision' }),
    admin,
    { env, fetchImpl: store.fetchImpl },
  )
  assert.equal(response.status, 409)
  assert.equal(store.calls.some(({ options }) => options.method === 'PUT'), false)
})
