import { useEffect, useState } from 'react'
import './App.css'
import ContactForm from './components/ContactForm'
import {
  aboutContent as staticAboutContent,
  albums as staticAlbums,
  brand as staticBrand,
  founders as staticFounders,
  missionContent as staticMissionContent,
  navLinks,
  retreatsContent as staticRetreatsContent,
} from './siteData'
import { useSiteContent } from './content/useSiteContent.js'

const retreatPhotos = [...staticRetreatsContent.gallery, ...staticRetreatsContent.morePhotos]
const retreatAlbum = {
  slug: 'retreats',
  title: 'Retreats in Scotland',
  photos: retreatPhotos.map((photo) => photo.src),
}

const thumbnailFor = (photo) => photo.includes('/retreat-gallery/')
  ? photo.replace('/retreat-gallery/', '/retreat-gallery/thumbs/')
  : photo.replace('/photos/', '/thumbs/')

function SectionHeading({ eyebrow, title, body, align = 'left' }) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {body ? <p className="section-body">{body}</p> : null}
    </div>
  )
}

function EditSectionButton({ admin, sectionId, label }) {
  if (!admin || admin.mode !== 'edit') return null

  return (
    <div className="inline-edit-anchor">
      <button type="button" className="inline-edit-trigger" onClick={() => admin.openEditor(sectionId)} aria-label={`Edit ${label} section`}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L9 17l-4 1 1-4Z" />
        </svg>
        <span>Edit</span>
      </button>
    </div>
  )
}

function App({ admin = null }) {
  const liveContent = useSiteContent()
  const content = admin?.content ?? liveContent
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const brand = { ...staticBrand, ...content.brand }
  const heroHighlights = content.hero.highlights
  const aboutContent = { ...staticAboutContent, ...content.about }
  const founders = content.about.founders.map((founder, index) => ({
    ...staticFounders[index],
    ...founder,
  }))
  const missionContent = { ...staticMissionContent, ...content.missions }
  const partners = content.missions.partners
  const retreatsContent = { ...staticRetreatsContent, ...content.retreats }
  const albums = staticAlbums.map((album, index) => ({
    ...album,
    ...content.albums.entries[index],
  }))

  const activeAlbum = lightbox
    ? lightbox.albumSlug === 'retreats'
      ? retreatAlbum
      : albums.find((album) => album.slug === lightbox.albumSlug)
    : null
  const activePhoto = activeAlbum?.photos[lightbox?.photoIndex ?? 0]
  const activePhotoCount = activeAlbum?.photos.length ?? 0
  const activePhotoAlt = lightbox?.albumSlug === 'retreats'
    ? retreatPhotos[lightbox.photoIndex]?.alt
    : `${activeAlbum?.title} photo ${(lightbox?.photoIndex ?? 0) + 1}`

  useEffect(() => {
    if (!activePhotoCount) {
      document.body.style.overflow = ''
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightbox(null)
      }

      if (event.key === 'ArrowRight') {
        setLightbox((current) =>
          current
            ? {
                ...current,
                photoIndex:
                  (current.photoIndex + 1) % activePhotoCount,
              }
            : current,
        )
      }

      if (event.key === 'ArrowLeft') {
        setLightbox((current) =>
          current
            ? {
                ...current,
                photoIndex:
                  (current.photoIndex - 1 + activePhotoCount) %
                  activePhotoCount,
              }
            : current,
        )
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activePhotoCount])

  const openGallery = (albumSlug) => setLightbox({ albumSlug, photoIndex: 0 })

  const stepLightbox = (direction) => {
    if (!activeAlbum) {
      return
    }

    setLightbox((current) =>
      current
        ? {
            ...current,
            photoIndex:
              (current.photoIndex + direction + activeAlbum.photos.length) %
              activeAlbum.photos.length,
          }
        : current,
    )
  }

  const closeMenu = () => setIsMenuOpen(false)

  return (
    <div className="page-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <a className="brand-lockup" href="#home" onClick={closeMenu}>
            <img className="brand-lockup__mark" src={brand.logo} alt="" />
            <div>
              <strong>{brand.name}</strong>
              <span>{brand.tagline}</span>
            </div>
          </a>

          <button
            type="button"
            className="menu-toggle"
            aria-expanded={isMenuOpen}
            aria-label="Toggle navigation"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

          <div
            className={`site-nav-wrap ${isMenuOpen ? 'site-nav-wrap--open' : ''}`}
          >
            <nav className="site-nav" aria-label="Primary">
              {navLinks.map((link) => (
                <a key={link.href} href={link.href} onClick={closeMenu}>
                  {link.label}
                </a>
              ))}
            </nav>

            <div className="site-nav-secondary">
              <a href="#contact" onClick={closeMenu}>
                Contact
              </a>
            </div>
          </div>

          <div className="header-utility">
            <a href="#contact">Contact</a>
          </div>
        </div>
      </header>

      <main className="page-main">
        <section className="hero-shell" id="home">
          <div
            className="hero-media"
            style={{
              '--hero-image': `url(${brand.heroImage})`,
              '--hero-mobile-image': `url(${brand.heroMobileImage})`,
            }}
          ></div>
          <div className="hero-scrim"></div>
          <div className="hero-haze"></div>

          <div className="hero-content">
            <EditSectionButton admin={admin} sectionId="hero" label="hero" />
            <div className="hero-brandmark">
              <img className="hero-logo" src={brand.logo} alt="" />
              <p className="hero-overline">{content.hero.overline}</p>
              <h1>{brand.name}</h1>
              <p className="hero-tagline">{brand.tagline}</p>
              <p className="hero-lead">{aboutContent.lead}</p>

              <div className="hero-actions">
                <a className="button button--solid" href="#missions">
                  {content.hero.missionsButton}
                </a>
                <a className="button button--ghost" href="#albums">
                  {content.hero.albumsButton}
                </a>
              </div>
            </div>

            <div className="hero-rail">
              {heroHighlights.map((item, index) => (
                <article key={index} className="hero-card">
                  <p className="section-eyebrow">{item.title}</p>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="content-stack">
          <section className="content-section" id="about">
            <EditSectionButton admin={admin} sectionId="about" label="About" />
            <SectionHeading
              eyebrow={aboutContent.eyebrow}
              title={aboutContent.title}
              body={content.about.intro}
            />

            <div className="about-layout">
              <article className="story-card">
                <img
                  className="story-card__image"
                  src={aboutContent.image}
                  alt="Access Scotland founders and ministry life in Scotland"
                  loading="lazy"
                  decoding="async"
                />

                <div className="story-card__body">
                  <p className="story-card__lead">{aboutContent.lead}</p>
                  {aboutContent.paragraphs.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </div>
              </article>

              <aside className="founders-panel">
                <div className="founders-grid">
                  {founders.map((founder, index) => (
                    <article key={index} className="founder-card">
                      <img
                        src={founder.image}
                        alt={founder.name}
                        loading="lazy"
                        decoding="async"
                        style={
                          founder.imagePosition
                            ? { objectPosition: founder.imagePosition }
                            : undefined
                        }
                      />
                      <h3>{founder.name}</h3>
                      <p className="founder-card__title">{founder.role}</p>
                      <a href={`mailto:${founder.email}`}>{founder.email}</a>
                    </article>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="content-section content-section--mission" id="missions">
            <EditSectionButton admin={admin} sectionId="missions" label="Missions" />
            <SectionHeading
              eyebrow={missionContent.eyebrow}
              title={missionContent.title}
              body={content.missions.intro}
            />

            <div className="mission-frame">
              <article className="mission-story-card">
                {missionContent.paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </article>

              <div className="mission-sidebar">
                <aside className="mission-highlights">
                  <p className="section-eyebrow">What this includes</p>
                  <h3>{content.missions.highlightsTitle}</h3>
                  <ul>
                    {missionContent.highlights.map((highlight, index) => (
                      <li key={index}>{highlight}</li>
                    ))}
                  </ul>
                </aside>

                <aside className="mission-callout">
                  <p className="section-eyebrow">
                    {missionContent.invitationTitle}
                  </p>
                  <h3>{content.missions.invitationHeading}</h3>
                  {missionContent.invitationBody.map((paragraph, index) => (
                    <p key={index}>{paragraph}</p>
                  ))}
                </aside>
              </div>
            </div>

            <div className="partner-section">
              <div className="partner-section__copy">
                <p className="section-eyebrow">Meet our partners</p>
                <h3>{content.missions.partnersTitle}</h3>
                <p>{content.missions.partnersIntro}</p>
              </div>

              <div className="partner-grid">
                {partners.map((partner, index) => (
                  <a
                    key={index}
                    className="partner-card"
                    href={partner.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <strong>{partner.name}</strong>
                    <span>{partner.place}</span>
                  </a>
                ))}
              </div>
            </div>
          </section>

          <section className="content-section" id="retreats">
            <EditSectionButton admin={admin} sectionId="retreats" label="Retreats" />
            <SectionHeading
              eyebrow={retreatsContent.eyebrow}
              title={retreatsContent.title}
              body={retreatsContent.lead}
            />

            <div className="retreat-hero">
              <article className="retreat-overview">
                <p className="section-eyebrow">Build the rhythm</p>
                <h3>{content.retreats.overviewTitle}</h3>
                <p>{retreatsContent.itineraryIntro}</p>

                <div className="activity-grid">
                  {retreatsContent.activities.map((activity, index) => (
                    <span key={index} className="activity-pill">
                      {activity}
                    </span>
                  ))}
                </div>
              </article>

              <div className="retreat-modes">
                {retreatsContent.offerings.map((offering, index) => (
                  <article key={index} className="retreat-mode">
                    <p className="section-eyebrow">{offering.title}</p>
                    <p>{offering.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="retreat-visuals">
              <div className="retreat-gallery-wrap">
                <div className="retreat-gallery">
                  {retreatsContent.gallery.map((photo) => (
                    <figure key={photo.src} className="retreat-gallery__item">
                      <img
                        src={photo.src}
                        alt={photo.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    </figure>
                  ))}
                </div>
                <button
                  type="button"
                  className="button button--ghost retreat-gallery__all"
                  onClick={() => openGallery('retreats')}
                >
                  View all {retreatPhotos.length} photos
                </button>
              </div>

              <aside className="retreat-destinations">
                <p className="section-eyebrow">Highlights</p>
                <h3>{content.retreats.highlightsTitle}</h3>

                <div className="destination-grid">
                  {retreatsContent.highlights.map((highlight, index) => (
                    <span key={index} className="destination-card">
                      {highlight}
                    </span>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="content-section albums-section" id="albums">
            <EditSectionButton admin={admin} sectionId="albums" label="Albums" />
            <SectionHeading
              eyebrow="Albums"
              title={content.albums.title}
              body={content.albums.intro}
              align="center"
            />

            <div className="album-grid">
              {albums.map((album) => (
                <article key={album.slug} className="album-card">
                  {album.cover ? (
                    <img src={album.cover} alt={album.title} loading="lazy" decoding="async" />
                  ) : (
                    <div className="album-card__placeholder" aria-hidden="true">Archive pending</div>
                  )}

                  <div className="album-card__body">
                    <p className="album-card__meta">
                      {album.date} · {album.photos.length} of {album.photosCount} photos available
                    </p>
                    <h3>{album.title}</h3>
                    <p>{album.summary}</p>

                    <div className="album-card__actions">
                      {album.photos.length > 0 ? (
                        <button
                          type="button"
                          className="button button--solid"
                          onClick={() => openGallery(album.slug)}
                        >
                          Open gallery
                        </button>
                      ) : (
                        <span className="album-card__status">Gallery coming soon</span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>

          </section>

        </div>
      </main>

      <footer className="site-footer" id="contact">
        <EditSectionButton admin={admin} sectionId="footer" label="Contact" />
        <div className="site-footer__intro">
          <p className="section-eyebrow">Contact Access Scotland</p>
          <h2>{content.footer.title}</h2>
          <p>{content.footer.intro}</p>
        </div>

        <ContactForm />

        <div className="site-footer__contacts">
          <p className="section-eyebrow">Contact</p>
          {founders.map((founder, index) => (
            <a key={index} href={`mailto:${founder.email}`}>
              <strong>{founder.name}</strong>
              <span>{founder.role}</span>
            </a>
          ))}
          <p className="site-footer__copyright">{content.footer.copyright}</p>
          <a className="site-footer__admin-link" href="/admin">
            Admin sign in
          </a>
        </div>
      </footer>

      {activeAlbum && activePhoto ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lightbox-title"
        >
          <button
            type="button"
            className="lightbox__scrim"
            aria-label="Close gallery"
            onClick={() => setLightbox(null)}
          ></button>

          <div className="lightbox__panel">
            <div className="lightbox__topbar">
              <div>
                <p className="section-eyebrow">Gallery</p>
                <h3 id="lightbox-title">{activeAlbum.title}</h3>
                <p className="lightbox__count">
                  Photo {lightbox.photoIndex + 1} of {activeAlbum.photos.length}
                </p>
              </div>

              <button
                type="button"
                className="lightbox__close"
                aria-label="Close gallery"
                onClick={() => setLightbox(null)}
              >
                Close
              </button>
            </div>

            <div className="lightbox__stage">
              <button
                type="button"
                className="lightbox__nav"
                aria-label="Previous photo"
                onClick={() => stepLightbox(-1)}
              >
                ‹
              </button>

              <img
                className="lightbox__image"
                src={activePhoto}
                alt={activePhotoAlt}
              />

              <button
                type="button"
                className="lightbox__nav"
                aria-label="Next photo"
                onClick={() => stepLightbox(1)}
              >
                ›
              </button>
            </div>

            <div className="lightbox__strip">
              {activeAlbum.photos.map((photo, index) => (
                <button
                  key={photo}
                  type="button"
                  className={`lightbox__thumb ${
                    index === lightbox.photoIndex ? 'lightbox__thumb--active' : ''
                  }`}
                  onClick={() => setLightbox({ albumSlug: activeAlbum.slug, photoIndex: index })}
                >
                  <img src={thumbnailFor(photo)} alt="" loading="lazy" decoding="async" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
