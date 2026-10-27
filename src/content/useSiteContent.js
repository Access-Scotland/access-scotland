import { useEffect, useState } from 'react'
import { defaultSiteContent, parseSiteContent } from './siteContent.js'

export function useSiteContent() {
  const [content, setContent] = useState(defaultSiteContent)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const response = await fetch('/api/content', { signal: controller.signal })
        if (!response.ok) throw new Error('Content request failed.')
        const result = await response.json()
        if (!controller.signal.aborted) setContent(parseSiteContent(result.content))
      } catch (error) {
        if (!controller.signal.aborted) console.error('Using bundled site content', error)
      }
    }
    load()
    return () => controller.abort()
  }, [])

  return content
}
