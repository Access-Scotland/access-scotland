import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeAdmin, handleAdminSession } from '../src/server/admin-auth.js'

const request = (method = 'GET') =>
  new Request('https://example.netlify.app/api/admin/session', { method })

test('guests cannot access the admin session endpoint', async () => {
  const response = await handleAdminSession(request(), async () => null)

  assert.equal(response.status, 401)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
})

test('signed-in users without the admin role are forbidden', async () => {
  const response = await handleAdminSession(request(), async () => ({
    id: 'member-1',
    email: 'member@example.com',
    roles: ['member'],
  }))

  assert.equal(response.status, 403)
})

test('role names must come from a role list', async () => {
  const response = await handleAdminSession(request(), async () => ({
    id: 'member-2',
    roles: 'superadmin',
  }))

  assert.equal(response.status, 403)
})

test('admins receive only their basic account details', async () => {
  const response = await handleAdminSession(request(), async () => ({
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    roles: ['admin'],
    appMetadata: { privateValue: 'not returned' },
  }))

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), {
    user: { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
  })
})

test('unsupported methods do not look up the user', async () => {
  const response = await handleAdminSession(request('POST'), () => {
    throw new Error('The user lookup should not run')
  })

  assert.equal(response.status, 405)
  assert.equal(response.headers.get('Allow'), 'GET')
})

test('admin authorization can be reused by future endpoints', async () => {
  const access = await authorizeAdmin(async () => ({ roles: ['editor', 'admin'] }))

  assert.equal(access.status, 200)
})
