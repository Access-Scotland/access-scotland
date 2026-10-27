import assert from 'node:assert/strict'
import test from 'node:test'
import { defaultSiteContent, parseSiteContent } from '../src/content/siteContent.js'

test('content parser retains defaults for newly added fields', () => {
  const older = structuredClone(defaultSiteContent)
  delete older.footer.copyright
  assert.equal(parseSiteContent(older).footer.copyright, defaultSiteContent.footer.copyright)
})

test('content parser rejects unsafe partner links and missing copy', () => {
  const content = structuredClone(defaultSiteContent)
  content.missions.partners[0].href = 'javascript:alert(1)'
  assert.throws(() => parseSiteContent(content, { strict: true }), /HTTPS link/)
  content.missions.partners[0].href = 'https://example.com'
  content.about.title = ''
  assert.throws(() => parseSiteContent(content, { strict: true }), /1 to 6000 characters/)
})

test('album and contact records cannot be removed from static media', () => {
  const content = structuredClone(defaultSiteContent)
  content.albums.entries.pop()
  assert.throws(() => parseSiteContent(content, { strict: true }), /retain its 4 items/)
})
