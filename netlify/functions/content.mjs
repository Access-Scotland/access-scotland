import { handleContentRequest } from '../../src/server/content-handler.js'

export default (request) => handleContentRequest(request)

export const config = { path: '/api/content' }
