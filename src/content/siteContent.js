import {
  aboutContent,
  albums,
  brand,
  founders,
  heroHighlights,
  missionContent,
  partners,
  retreatsContent,
} from '../siteData.js'

export const defaultSiteContent = {
  brand: { name: brand.name, tagline: brand.tagline },
  hero: {
    overline: 'Mission partnerships, retreats, and story-rich travel in Scotland',
    missionsButton: 'Explore missions',
    albumsButton: 'Browse galleries',
    highlights: heroHighlights,
  },
  about: {
    eyebrow: aboutContent.eyebrow,
    title: aboutContent.title,
    intro: 'The information stays intact here, but the reading flow is tightened up for mobile and the founder details sit in a cleaner, more balanced layout.',
    lead: aboutContent.lead,
    paragraphs: aboutContent.paragraphs,
    founders: founders.map(({ name, role, email }) => ({ name, role, email })),
  },
  missions: {
    eyebrow: missionContent.eyebrow,
    title: missionContent.title,
    intro: 'The fuller mission story from the original site is restored here, then broken into clearer blocks so it reads comfortably on phones and stays legible across the page.',
    paragraphs: missionContent.paragraphs,
    highlightsTitle: 'How the work takes shape on the ground.',
    highlights: missionContent.highlights,
    invitationTitle: missionContent.invitationTitle,
    invitationHeading: 'Trips can be tailored to the gifts your team brings.',
    invitationBody: missionContent.invitationBody,
    partnersTitle: 'Churches and organizations already connected to the work.',
    partnersIntro: 'These relationships stay visible in the new build so the mission network feels just as tangible as it does on the existing site.',
    partners,
  },
  retreats: {
    eyebrow: retreatsContent.eyebrow,
    title: retreatsContent.title,
    lead: retreatsContent.lead,
    overviewTitle: 'Plan a retreat that feels intentional instead of pieced together.',
    itineraryIntro: retreatsContent.itineraryIntro,
    activities: retreatsContent.activities,
    offerings: retreatsContent.offerings,
    highlightsTitle: 'Landmarks and landscapes that can anchor the itinerary.',
    highlights: retreatsContent.highlights,
  },
  albums: {
    title: 'Moments from the journey, gathered in one place.',
    intro: 'Explore the galleries below. New albums can be added as more stories unfold.',
    entries: albums.map(({ title, date, summary }) => ({ title, date, summary })),
  },
  footer: {
    title: 'Start a conversation about Scotland.',
    intro: 'Whether you are exploring a mission partnership, planning a retreat, or simply want to learn more, we would be glad to hear from you.',
    copyright: '\u00a9 2022 Access Scotland.',
  },
}

const fixedLists = new Set(['about.founders', 'albums.entries', 'hero.highlights', 'retreats.offerings'])

export function parseSiteContent(input, { strict = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Site content must be an object.')
  }

  const parse = (template, value, path) => {
    if (value === undefined && !strict) return structuredClone(template)

    if (typeof template === 'string') {
      if (typeof value !== 'string') throw new Error(`${path} must be text.`)
      const text = value.trim()
      if (!text || text.length > 6000) throw new Error(`${path} must be 1 to 6000 characters.`)
      if (path.endsWith('.href')) {
        let url
        try {
          url = new URL(text)
        } catch {
          throw new Error(`${path} must be an HTTPS link.`)
        }
        if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
          throw new Error(`${path} must be an HTTPS link.`)
        }
      }
      if (path.endsWith('.email') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) {
        throw new Error(`${path} must be an email address.`)
      }
      return text
    }

    if (Array.isArray(template)) {
      if (!Array.isArray(value)) throw new Error(`${path} must be a list.`)
      if (value.length < 1 || value.length > 40) throw new Error(`${path} must have 1 to 40 items.`)
      if (fixedLists.has(path) && value.length !== template.length) {
        throw new Error(`${path} must retain its ${template.length} items.`)
      }
      return value.map((item, index) => parse(
        fixedLists.has(path) ? template[index] : template[0],
        item,
        `${path}.${index}`,
      ))
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error(`${path} must be an object.`)
    }
    return Object.fromEntries(Object.entries(template).map(([key, field]) => [
      key,
      parse(field, value[key], path ? `${path}.${key}` : key),
    ]))
  }

  return parse(defaultSiteContent, input, '')
}
