import { useEffect, useState } from 'react'
import './App.css'
import ContactForm from './components/ContactForm'
import {
  aboutContent,
  albums,
  brand,
  founders,
  heroHighlights,
  missionContent,
  navLinks,
  partners,
  retreatsContent,
} from './siteData'

function SectionHeading({ eyebrow, title, body, align = 'left' }) {
  return (
    <div className={`section-heading section-heading--${align}`}>
      <p className="section-eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {body ? <p className="section-body">{body}</p> : null}
    </div>
  )
}

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  const activeAlbum = lightbox
    ? albums.find((album) => album.slug === lightbox.albumSlug)
    : null
  const activePhoto = activeAlbum?.photos[lightbox?.photoIndex ?? 0]

  useEffect(() => {
    if (!activeAlbum) {
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
                  (current.photoIndex + 1) % activeAlbum.photos.length,
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
                  (current.photoIndex - 1 + activeAlbum.photos.length) %
                  activeAlbum.photos.length,
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
  }, [activeAlbum])

  const openGallery = (albumSlug, photoIndex = 0) => {
    setLightbox({ albumSlug, photoIndex })
  }

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
            style={{ backgroundImage: `url(${brand.heroImage})` }}
          ></div>
          <div className="hero-scrim"></div>
          <div className="hero-haze"></div>

          <div className="hero-content">
            <div className="hero-brandmark">
              <img className="hero-logo" src={brand.logo} alt="" />
              <p className="hero-overline">
                Mission partnerships, retreats, and story-rich travel in
                Scotland
              </p>
              <h1>{brand.name}</h1>
              <p className="hero-tagline">{brand.tagline}</p>
              <p className="hero-lead">{aboutContent.lead}</p>

              <div className="hero-actions">
                <a className="button button--solid" href="#missions">
                  Explore missions
                </a>
                <a className="button button--ghost" href="#albums">
                  Browse galleries
                </a>
              </div>
            </div>

            <div className="hero-rail">
              {heroHighlights.map((item) => (
                <article key={item.title} className="hero-card">
                  <p className="section-eyebrow">{item.title}</p>
                  <p>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="content-stack">
          <section className="content-section" id="about">
            <SectionHeading
              eyebrow={aboutContent.eyebrow}
              title={aboutContent.title}
              body="The information stays intact here, but the reading flow is tightened up for mobile and the founder details sit in a cleaner, more balanced layout."
            />

            <div className="about-layout">
              <article className="story-card">
                <img
                  className="story-card__image"
                  src={aboutContent.image}
                  alt="Access Scotland founders and ministry life in Scotland"
                />

                <div className="story-card__body">
                  <p className="story-card__lead">{aboutContent.lead}</p>
                  {aboutContent.paragraphs.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </article>

              <aside className="founders-panel">
                <div className="founders-grid">
                  {founders.map((founder) => (
                    <article key={founder.email} className="founder-card">
                      <img
                        src={founder.image}
                        alt={founder.name}
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
            <SectionHeading
              eyebrow={missionContent.eyebrow}
              title={missionContent.title}
              body="The fuller mission story from the original site is restored here, then broken into clearer blocks so it reads comfortably on phones and stays legible across the page."
            />

            <div className="mission-frame">
              <article className="mission-story-card">
                {missionContent.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </article>

              <div className="mission-sidebar">
                <aside className="mission-highlights">
                  <p className="section-eyebrow">What this includes</p>
                  <h3>How the work takes shape on the ground.</h3>
                  <ul>
                    {missionContent.highlights.map((highlight) => (
                      <li key={highlight}>{highlight}</li>
                    ))}
                  </ul>
                </aside>

                <aside className="mission-callout">
                  <p className="section-eyebrow">
                    {missionContent.invitationTitle}
                  </p>
                  <h3>Trips can be tailored to the gifts your team brings.</h3>
                  {missionContent.invitationBody.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </aside>
              </div>
            </div>

            <div className="partner-section">
              <div className="partner-section__copy">
                <p className="section-eyebrow">Meet our partners</p>
                <h3>Churches and organizations already connected to the work.</h3>
                <p>
                  These relationships stay visible in the new build so the
                  mission network feels just as tangible as it does on the
                  existing site.
                </p>
              </div>

              <div className="partner-grid">
                {partners.map((partner) => (
                  <a
                    key={partner.name}
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
            <SectionHeading
              eyebrow={retreatsContent.eyebrow}
              title={retreatsContent.title}
              body={retreatsContent.lead}
            />

            <div className="retreat-hero">
              <article className="retreat-overview">
                <p className="section-eyebrow">Build the rhythm</p>
                <h3>Plan a retreat that feels intentional instead of pieced together.</h3>
                <p>{retreatsContent.itineraryIntro}</p>

                <div className="activity-grid">
                  {retreatsContent.activities.map((activity) => (
                    <span key={activity} className="activity-pill">
                      {activity}
                    </span>
                  ))}
                </div>
              </article>

              <div className="retreat-modes">
                {retreatsContent.offerings.map((offering) => (
                  <article key={offering.title} className="retreat-mode">
                    <p className="section-eyebrow">{offering.title}</p>
                    <p>{offering.description}</p>
                  </article>
                ))}
              </div>
            </div>

            <div className="retreat-visuals">
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

              <aside className="retreat-destinations">
                <p className="section-eyebrow">Highlights</p>
                <h3>Landmarks and landscapes that can anchor the itinerary.</h3>

                <div className="destination-grid">
                  {retreatsContent.highlights.map((highlight) => (
                    <span key={highlight} className="destination-card">
                      {highlight}
                    </span>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="content-section albums-section" id="albums">
            <SectionHeading
              eyebrow="Albums"
              title="A smoother gallery browse now, with future admin management in mind."
              body="This first React pass keeps the photo gallery functionality alive with static data now, while leaving room for a later admin-managed media structure."
              align="center"
            />

            <div className="album-grid">
              {albums.map((album) => (
                <article key={album.slug} className="album-card">
                  <img src={album.cover} alt={album.title} />

                  <div className="album-card__body">
                    <p className="album-card__meta">
                      {album.date} · {album.photosCount} photos
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
                        <a
                          className="button button--solid"
                          href={album.archiveUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View live archive
                        </a>
                      )}

                      <a
                        className="button button--ghost"
                        href={album.archiveUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Original album
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="roadmap-card">
              <p className="section-eyebrow">Phase two</p>
              <h3>Gallery management that keeps albums easy to update.</h3>
              <p>
                The gallery data in this prototype is already shaped like
                content records. That makes it straightforward to swap the
                static objects for a future admin source when the final media
                workflow is ready.
              </p>
            </div>
          </section>

        </div>
      </main>

      <footer className="site-footer" id="contact">
        <div className="site-footer__intro">
          <p className="section-eyebrow">Contact Access Scotland</p>
          <h2>Start a conversation about Scotland.</h2>
          <p>
            Whether you are exploring a mission partnership, planning a retreat,
            or simply want to learn more, we would be glad to hear from you.
          </p>
        </div>

        <ContactForm />

        <div className="site-footer__contacts">
          <p className="section-eyebrow">Contact</p>
          {founders.map((founder) => (
            <a key={founder.email} href={`mailto:${founder.email}`}>
              <strong>{founder.name}</strong>
              <span>{founder.role}</span>
            </a>
          ))}
          <p className="site-footer__copyright">© 2022 Access Scotland.</p>
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
                alt={`${activeAlbum.title} photo ${lightbox.photoIndex + 1}`}
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
                  onClick={() => openGallery(activeAlbum.slug, index)}
                >
                  <img src={photo} alt="" />
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
