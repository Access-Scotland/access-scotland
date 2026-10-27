import { useEffect, useRef, useState } from 'react'
import { getUser, logout } from '@netlify/identity'
import App from './App.jsx'
import { defaultSiteContent, parseSiteContent } from './content/siteContent.js'
import { editorSections } from './content/editorSections.js'
import './AdminApp.css'
import './AdminEditor.css'

const clone = (value) => structuredClone(value)
const getAt = (object, path) => path.split('.').reduce((value, key) => value[key], object)
const setAt = (object, path, value) => {
  const keys = path.split('.')
  const last = keys.pop()
  const parent = keys.reduce((current, key) => current[key], object)
  parent[last] = value
}

function TextControl({ label, value, onChange, multiline, inputType = 'text' }) {
  return (
    <label className="editor-field">
      <span>{label}</span>
      {multiline ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} />
      ) : (
        <input type={inputType} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  )
}

function EditorField({ field, value, onChange }) {
  if (field.kind === 'list') {
    return (
      <fieldset className="editor-group">
        <legend>{field.label}</legend>
        {value.map((item, index) => (
          <div className="editor-list-row" key={index}>
            <TextControl
              label={`${field.label} ${index + 1}`}
              value={item}
              multiline={field.multiline}
              onChange={(next) => onChange(value.map((entry, position) => position === index ? next : entry))}
            />
            <button type="button" className="editor-small-button" disabled={value.length === 1} onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove</button>
          </div>
        ))}
        <button type="button" className="editor-small-button" disabled={value.length >= 40} onClick={() => onChange([...value, ''])}>Add item</button>
      </fieldset>
    )
  }

  if (field.kind === 'records') {
    return (
      <fieldset className="editor-group">
        <legend>{field.label}</legend>
        {value.map((item, index) => (
          <div className="editor-record" key={index}>
            <div className="editor-record__heading">
              <strong>{item.title || item.name || `Item ${index + 1}`}</strong>
              {!field.fixed ? (
                <button type="button" className="editor-small-button" disabled={value.length === 1} onClick={() => onChange(value.filter((_, position) => position !== index))}>Remove</button>
              ) : null}
            </div>
            {field.itemFields.map((itemField) => (
              <TextControl
                key={itemField.key}
                label={itemField.label}
                value={item[itemField.key]}
                multiline={itemField.multiline}
                inputType={itemField.inputType}
                onChange={(next) => onChange(value.map((entry, position) => position === index ? { ...entry, [itemField.key]: next } : entry))}
              />
            ))}
          </div>
        ))}
        {!field.fixed ? (
          <button type="button" className="editor-small-button" disabled={value.length >= 40} onClick={() => onChange([...value, clone(field.newItem)])}>Add partner</button>
        ) : null}
      </fieldset>
    )
  }

  return <TextControl label={field.label} value={value} onChange={onChange} multiline={field.multiline} />
}

function AdminEditor() {
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [draft, setDraft] = useState(() => clone(defaultSiteContent))
  const [published, setPublished] = useState(() => clone(defaultSiteContent))
  const [revision, setRevision] = useState(null)
  const [configured, setConfigured] = useState(false)
  const [mode, setMode] = useState('edit')
  const [sectionId, setSectionId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const closeButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const triggerRef = useRef(null)
  const leavingRef = useRef(false)
  const dirty = JSON.stringify(draft) !== JSON.stringify(published)
  const section = editorSections.find((item) => item.id === sectionId)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        await getUser()
        const sessionResponse = await fetch('/api/admin/session', {
          cache: 'no-store',
          credentials: 'same-origin',
          headers: { Accept: 'application/json' },
        })
        if (cancelled) return
        if (sessionResponse.status === 401) { setStatus('login'); return }
        if (sessionResponse.status === 403) { setStatus('forbidden'); return }
        if (!sessionResponse.ok || !sessionResponse.headers.get('Content-Type')?.includes('application/json')) {
          throw new Error('Admin sign in is unavailable. Please try again.')
        }
        const session = await sessionResponse.json()
        const contentResponse = await fetch('/api/content', { cache: 'no-store' })
        if (!contentResponse.ok) throw new Error('Could not load published content.')
        const result = await contentResponse.json()
        if (cancelled) return
        const next = parseSiteContent(result.content)
        setUser(session.user)
        setDraft(clone(next))
        setPublished(clone(next))
        setRevision(result.revision)
        setConfigured(Boolean(result.persistenceConfigured))
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not open admin mode.' })
        setStatus('error')
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty || leavingRef.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  useEffect(() => {
    if (!sectionId) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSectionId(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...drawerRef.current.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href]')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
      triggerRef.current?.focus()
    }
  }, [sectionId])

  const update = (path, value) => setDraft((current) => {
    const next = clone(current)
    setAt(next, path, value)
    return next
  })

  const save = async () => {
    if (!dirty || !configured || saving) return
    setNotice(null)
    let validated
    try {
      validated = parseSiteContent(draft, { strict: true })
    } catch (error) {
      setNotice({ tone: 'error', text: error.message })
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/content', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: validated, revision }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not publish changes.')
      const next = parseSiteContent(result.content)
      setDraft(clone(next))
      setPublished(clone(next))
      setRevision(result.revision)
      setNotice({ tone: 'success', text: 'Changes published. Visitors will see the new copy when they reload.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not publish changes.' })
    } finally {
      setSaving(false)
    }
  }

  const reload = async () => {
    if (dirty && !window.confirm('Discard your unsaved edits and reload published content?')) return
    setNotice(null)
    try {
      const response = await fetch('/api/content', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not reload published content.')
      const result = await response.json()
      const next = parseSiteContent(result.content)
      setDraft(clone(next))
      setPublished(clone(next))
      setRevision(result.revision)
      setConfigured(Boolean(result.persistenceConfigured))
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not reload published content.' })
    }
  }

  const signOut = async () => {
    if (dirty && !window.confirm('Sign out and discard your unsaved edits?')) return
    leavingRef.current = true
    try {
      await logout()
      window.location.assign('/')
    } catch (error) {
      leavingRef.current = false
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not sign out.' })
    }
  }

  if (status !== 'ready') {
    return (
      <main className="inline-admin-gate">
        <div className="inline-admin-gate__card">
          <p className="admin-eyebrow">Access Scotland</p>
          <h1>{status === 'loading' ? 'Opening admin mode...' : 'Admin mode is unavailable.'}</h1>
          {notice ? <p className="admin-notice admin-notice--error" role="alert">{notice.text}</p> : null}
          {status === 'forbidden' ? <p>This account does not have the admin role.</p> : null}
          {status === 'login' ? <p>Sign in to edit the site.</p> : null}
          {status !== 'loading' ? <a className="admin-button inline-admin-gate__link" href="/admin">Go to admin sign in</a> : null}
        </div>
      </main>
    )
  }

  return (
    <div className="inline-admin-shell">
      <App admin={{ mode, content: mode === 'edit' ? draft : published, openEditor: (id) => {
        triggerRef.current = document.activeElement
        setSectionId(id)
        setNotice(null)
      } }} />

      <div className="inline-admin-toolbar" aria-label="Admin controls">
        <div className="inline-admin-toolbar__identity">
          <strong>Admin mode</strong>
          <span>{dirty ? 'Unpublished changes' : `Signed in as ${user?.email}`}</span>
        </div>
        <div className="inline-admin-toolbar__actions">
          <button type="button" className="inline-admin-toolbar__mode" onClick={() => { setMode(mode === 'edit' ? 'view' : 'edit'); setSectionId(null) }}>
            {mode === 'edit' ? 'View mode' : 'Edit mode'}
          </button>
          <button type="button" className="inline-admin-toolbar__publish" disabled={!dirty || !configured || saving} onClick={save}>
            {saving ? 'Publishing...' : 'Publish changes'}
          </button>
          <button type="button" className="inline-admin-toolbar__exit" onClick={signOut}>Sign out</button>
        </div>
        {notice ? <p className={`inline-admin-toolbar__notice inline-admin-toolbar__notice--${notice.tone}`} role="status">{notice.text}</p> : null}
      </div>

      {section && mode === 'edit' ? (
        <div className="inline-editor-overlay">
          <button type="button" className="inline-editor-overlay__scrim" aria-label="Close editor" onClick={() => setSectionId(null)} />
          <aside className="inline-editor-drawer" role="dialog" aria-modal="true" aria-labelledby="inline-editor-title" ref={drawerRef}>
            <header className="inline-editor-drawer__header">
              <div>
                <p className="admin-eyebrow">Edit section</p>
                <h2 id="inline-editor-title">{section.title}</h2>
                <p>{section.description}</p>
              </div>
              <button type="button" className="inline-editor-drawer__close" onClick={() => setSectionId(null)} ref={closeButtonRef} aria-label="Close editor">&times;</button>
            </header>
            <div className="inline-editor-drawer__fields">
              <fieldset disabled={saving} className="inline-editor-drawer__fieldset">
                {section.fields.map((field) => (
                  <EditorField key={field.path} field={field} value={getAt(draft, field.path)} onChange={(value) => update(field.path, value)} />
                ))}
              </fieldset>
            </div>
            <footer className="inline-editor-drawer__footer">
              {!configured ? <p className="editor-setup">Publishing needs the GitHub App settings in Netlify.</p> : null}
              {notice ? <p className={`admin-notice admin-notice--${notice.tone}`} role="status">{notice.text}</p> : null}
              <p>{dirty ? 'Changes are only a draft until you publish.' : 'This matches the published site.'}</p>
              <div className="inline-editor-drawer__actions">
                <button type="button" className="editor-small-button" disabled={!dirty || saving} onClick={() => { setDraft(clone(published)); setNotice(null) }}>Discard draft</button>
                <button type="button" className="editor-small-button" disabled={saving} onClick={reload}>Reload published</button>
                <button type="button" className="admin-button" disabled={!dirty || !configured || saving} onClick={save}>{saving ? 'Publishing...' : 'Publish changes'}</button>
              </div>
            </footer>
          </aside>
        </div>
      ) : null}
    </div>
  )
}

export default AdminEditor
