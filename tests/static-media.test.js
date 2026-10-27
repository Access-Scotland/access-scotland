import assert from 'node:assert/strict'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { aboutContent, albums, brand, founders, retreatsContent } from '../src/siteData.js'

const publicRoot = path.resolve('public')

async function assertPublishedImage(url) {
  assert.match(url, /^\/media\//)
  const file = await stat(path.join(publicRoot, url.slice(1)))
  assert.ok(file.size > 0, `${url} should not be empty`)
}

test('site images are local and exist in the published folder', async () => {
  const urls = [
    brand.logo,
    brand.heroImage,
    brand.heroMobileImage,
    aboutContent.image,
    ...founders.map((founder) => founder.image),
    ...retreatsContent.gallery.map((photo) => photo.src),
    ...retreatsContent.morePhotos.map((photo) => photo.src),
  ]
  await Promise.all(urls.map(assertPublishedImage))

  for (const photo of [...retreatsContent.gallery, ...retreatsContent.morePhotos]) {
    const thumbnail = photo.src.replace('/retreat-gallery/', '/retreat-gallery/thumbs/')
    await assertPublishedImage(thumbnail)
    assert.ok((await stat(path.join(publicRoot, thumbnail.slice(1)))).size < 60_000)
  }
})

test('available album photos, covers, and thumbnails are published', async () => {
  for (const album of albums) {
    assert.ok(album.photos.length <= album.photosCount)
    if (album.cover) await assertPublishedImage(album.cover)
    for (const photo of album.photos) {
      await assertPublishedImage(photo)
      const thumbnail = photo.replace('/photos/', '/thumbs/')
      await assertPublishedImage(thumbnail)
      const file = await stat(path.join(publicRoot, thumbnail.slice(1)))
      assert.ok(file.size < 60_000, `${thumbnail} should be a small preview`)
    }
  }
})
