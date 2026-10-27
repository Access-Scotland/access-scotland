import { useEffect, useState } from 'react'
import { defaultSiteContent, parseSiteContent } from './content/siteContent.js'
import { editorSections } from './content/editorSections.js'

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

function AdminEditor({ user, onSignOut, signingOut }) {
  const [draft, setDraft] = useState(() => clone(defaultSiteContent))
  const [published, setPublished] = useState(() => clone(defaultSiteContent))
  const [revision, setRevision] = useState(null)
  const [configured, setConfigured] = useState(false)
  const [sectionId, setSectionId] = useState('hero')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)
  const dirty = JSON.stringify(draft) !== JSON.stringify(published)
  const section = editorSections.find((item) => item.id === sectionId)

  useEffect(() => {
    const beforeUnload = (event) => {
      if (!dirty) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [dirty])

  const refresh = async () => {
    if (dirty && !window.confirm('Discard your unsaved edits and reload published content?')) return
    setLoading(true)
    setNotice(null)
    try {
      const response = await fetch('/api/content', { cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load published content.')
      const result = await response.json()
      const next = parseSiteContent(result.content)
      setDraft(clone(next))
      setPublished(clone(next))
      setRevision(result.revision)
      setConfigured(Boolean(result.persistenceConfigured))
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load published content.' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch('/api/content', { cache: 'no-store' })
        if (!response.ok) throw new Error('Could not load published content.')
        const result = await response.json()
        if (cancelled) return
        const next = parseSiteContent(result.content)
        setDraft(clone(next))
        setPublished(clone(next))
        setRevision(result.revision)
        setConfigured(Boolean(result.persistenceConfigured))
      } catch (error) {
        if (!cancelled) setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load published content.' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const update = (path, value) => setDraft((current) => {
    const next = clone(current)
    setAt(next, path, value)
    return next
  })

  const save = async () => {
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
      if (!response.ok) throw new Error(result.error || 'Could not save changes.')
      const next = parseSiteContent(result.content)
      setDraft(clone(next))
      setPublished(clone(next))
      setRevision(result.revision)
      setNotice({ tone: 'success', text: 'Changes published. Visitors will see the updated copy when they reload the site.' })
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not save changes.' })
    } finally {
      setSaving(false)
    }
  }

  const signOut = () => {
    if (dirty && !window.confirm('Sign out and discard your unsaved edits?')) return
    onSignOut()
  }

  return (
    <div className="admin-editor">
      <div className="admin-editor__header">
        <p className="admin-eyebrow">Site content</p>
        <h1 id="admin-heading">Edit the story.</h1>
        <p className="admin-account">Signed in as {user?.email}</p>
        <p>Update the words on the site here. Photos stay in the static project for now.</p>
      </div>

      {!configured && !loading ? <p className="editor-setup">Editing is ready, but publishing needs the GitHub App settings in Netlify. You can review the fields now; saving will stay off until setup is complete.</p> : null}
      {notice ? <p className={`admin-notice admin-notice--${notice.tone}`} role="alert">{notice.text}</p> : null}

      <div className="editor-actions">
        <button type="button" className="admin-button" disabled={!dirty || !configured || loading || saving} onClick={save}>{saving ? 'Publishing...' : 'Publish changes'}</button>
        <button type="button" className="editor-small-button" disabled={!dirty || saving} onClick={() => { setDraft(clone(published)); setNotice(null) }}>Discard draft</button>
        <button type="button" className="editor-small-button" disabled={loading || saving} onClick={refresh}>Reload published</button>
        <a className="editor-small-button" href="/" target="_blank" rel="noreferrer">View site</a>
      </div>

      <nav className="editor-tabs" aria-label="Edit section">
        {editorSections.map((item) => (
          <button key={item.id} type="button" className={item.id === sectionId ? 'editor-tab editor-tab--active' : 'editor-tab'} aria-current={item.id === sectionId ? 'page' : undefined} onClick={() => setSectionId(item.id)}>{item.title}</button>
        ))}
      </nav>

      <section className="editor-section" aria-labelledby="editor-section-title">
        <div className="editor-section__intro">
          <h2 id="editor-section-title">{section.title}</h2>
          <p>{section.description}</p>
        </div>
        {loading ? <p role="status">Loading published content...</p> : section.fields.map((field) => (
          <EditorField key={field.path} field={field} value={getAt(draft, field.path)} onChange={(value) => update(field.path, value)} />
        ))}
      </section>

      <button className="admin-button admin-button--outline" type="button" onClick={signOut} disabled={signingOut}>{signingOut ? 'Signing out...' : 'Sign out'}</button>
    </div>
  )
}

export default AdminEditor
