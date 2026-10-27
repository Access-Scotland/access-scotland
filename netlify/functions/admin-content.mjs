import { getUser } from '@netlify/identity'
import { handleAdminContentRequest } from '../../src/server/content-handler.js'

export default (request) => handleAdminContentRequest(request, getUser)

export const config = { path: '/api/admin/content' }
