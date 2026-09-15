import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleContactRequest } from './src/server/contact-handler.js'

const contactApiPlugin = () => ({
  name: 'contact-api',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/api/contact', async (request, response) => {
      try {
        const chunks = []

        for await (const chunk of request) {
          chunks.push(chunk)
        }

        const method = request.method || 'GET'
        const body = chunks.length ? Buffer.concat(chunks) : undefined
        const webRequest = new Request('http://localhost/api/contact', {
          method,
          headers: request.headers,
          body: method === 'GET' || method === 'HEAD' ? undefined : body,
        })
        const webResponse = await handleContactRequest(webRequest, {
          remoteIp: request.socket.remoteAddress,
        })

        response.statusCode = webResponse.status
        webResponse.headers.forEach((value, key) => {
          response.setHeader(key, value)
        })
        response.end(await webResponse.text())
      } catch (error) {
        console.error('Local contact endpoint failed.', error)
        response.statusCode = 500
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify({ error: 'Local contact endpoint failed.' }))
      }
    })
  },
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = process.env[key] ?? value
  })

  return {
    plugins: [react(), contactApiPlugin()],
  }
})
