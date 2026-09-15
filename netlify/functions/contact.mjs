import { handleContactRequest } from '../../src/server/contact-handler.js'

export default async (request, context) =>
  handleContactRequest(request, { remoteIp: context.ip })

export const config = {
  path: '/api/contact',
}
