import { execFileSync } from 'node:child_process'
import { copyFile, readdir, mkdir, stat } from 'node:fs/promises'
import path from 'node:path'

const [albumsRoot, assetsRoot] = process.argv.slice(2).map((directory) => path.resolve(directory))

if (!albumsRoot || !assetsRoot) {
  console.error('Usage: node scripts/optimize-static-media.mjs <albums-folder> <assets-folder>')
  process.exit(1)
}

const outputRoot = path.resolve('public/media')
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif'])
const preferredCovers = { 'first-trip-on-our-own': '004.png' }
let originalsBytes = 0
let optimizedBytes = 0
let imageCount = 0

async function optimize(source, destination, maxSize, quality, format = 'jpeg') {
  await mkdir(path.dirname(destination), { recursive: true })
  const options = ['-s', 'format', format]
  if (format === 'jpeg') options.push('-s', 'formatOptions', String(quality))
  options.push('--resampleHeightWidthMax', String(maxSize), source, '--out', destination)
  execFileSync('sips', options, { stdio: 'pipe' })
  const sourceBytes = (await stat(source)).size
  let resultBytes = (await stat(destination)).size
  if (format === 'jpeg' && /\.jpe?g$/i.test(source) && sourceBytes < resultBytes) {
    const metadata = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', source], { encoding: 'utf8' })
    const width = Number(metadata.match(/pixelWidth:\s*(\d+)/)?.[1])
    const height = Number(metadata.match(/pixelHeight:\s*(\d+)/)?.[1])
    if (Math.max(width, height) <= maxSize) {
      await copyFile(source, destination)
      resultBytes = sourceBytes
    }
  }
  originalsBytes += sourceBytes
  optimizedBytes += resultBytes
  imageCount += 1
}

async function importAssets() {
  const assets = [
    ['hero.jpg', 'hero.jpg', 1600, 72],
    ['hero.jpg', 'hero-mobile.jpg', 840, 68],
    ['about-story.jpg', 'about-story.jpg', 1000, 70],
    ['founders/jonathan-lindsey.jpg', 'founders/jonathan-lindsey.jpg', 900, 72],
    ['founders/tony-brock.jpg', 'founders/tony-brock.jpg', 900, 72],
    ...Array.from({ length: 6 }, (_, index) => {
      const name = `retreat-gallery/${String(index + 1).padStart(2, '0')}.jpg`
      return [name, name, 1000, 70]
    }),
  ]

  for (const [source, destination, maxSize, quality] of assets) {
    await optimize(path.join(assetsRoot, source), path.join(outputRoot, 'assets', destination), maxSize, quality)
  }

  await optimize(
    path.join(assetsRoot, 'logo.png'),
    path.join(outputRoot, 'assets/logo.png'),
    450,
    0,
    'png',
  )

  const retreatOutput = path.join(outputRoot, 'assets/retreat-gallery')
  const retreatPhotos = (await readdir(retreatOutput))
    .filter((name) => name.endsWith('.jpg'))
    .sort()
  for (const photo of retreatPhotos) {
    await optimize(
      path.join(retreatOutput, photo),
      path.join(retreatOutput, 'thumbs', photo),
      240,
      60,
    )
  }
}

async function importAlbums() {
  const folders = (await readdir(albumsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((left, right) => left.name.localeCompare(right.name))

  for (const folder of folders) {
    const photosRoot = path.join(albumsRoot, folder.name, 'photos')
    let photos
    try {
      photos = (await readdir(photosRoot))
        .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
        .sort()
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      console.log(`${folder.name}: no photos to import`)
      continue
    }

    for (const photo of photos) {
      const source = path.join(photosRoot, photo)
      const name = `${path.parse(photo).name}.jpg`
      const albumOutput = path.join(outputRoot, 'albums', folder.name)
      await optimize(source, path.join(albumOutput, 'photos', name), 1600, 72)
      await optimize(source, path.join(albumOutput, 'thumbs', name), 240, 60)
    }

    if (photos.length > 0) {
      const coverPath = path.join(outputRoot, 'albums', folder.name, 'cover.jpg')
      let coverExists = true
      try {
        await stat(coverPath)
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
        coverExists = false
      }
      if (!coverExists) {
        await optimize(
          path.join(photosRoot, preferredCovers[folder.name] || photos[0]),
          coverPath,
          900,
          70,
        )
      }
    }
    console.log(`${folder.name}: ${photos.length} photos`)
  }
}

await importAssets()
await importAlbums()
console.log(`${imageCount} image outputs; ${Math.round(originalsBytes / 1024)} KB source reads -> ${Math.round(optimizedBytes / 1024)} KB optimized`)
