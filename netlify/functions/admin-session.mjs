import { getUser } from '@netlify/identity'
import { handleAdminSession } from '../../src/server/admin-auth.js'

export default (request) => handleAdminSession(request, getUser)

export const config = {
  path: '/api/admin/session',
}
