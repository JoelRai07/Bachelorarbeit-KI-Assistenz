import { useState } from 'react'

/**
 * ContactForm – enthält folgende Violations:
 *   V6:  onClick-Handler auf <div> ohne onKeyDown (semantisch, WCAG 2.1.1)
 *   V7:  role="button" auf <div> ohne tabIndex (semantisch, WCAG 4.1.2)
 *   V8:  Modaler Dialog ohne Fokus-Trap (semantisch, WCAG 2.1.2)
 *   V12: Senden-Button zu klein – 18x18px (layout, WCAG 2.5.8)
 */
export default function ContactForm() {
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [topic, setTopic] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section className="form-container">
      <h1 className="form-title">Kontaktformular</h1>

      <div className="form-body">
        <div className="field-group">
          <label htmlFor="name" className="field-label">Name</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="field-input"
            placeholder="Ihr Name"
          />
        </div>

        {/*
          V6: Diese "Themen-Kacheln" reagieren nur auf Mausklick.
          onClick ohne onKeyDown/onKeyPress → Tastaturnutzer können nicht interagieren.
          (semantisch, WCAG 2.1.1)
        */}
        <div className="field-group">
          <span className="field-label">Betreff auswählen</span>
          <div className="topic-grid">
            {['Allgemein', 'Technisch', 'Abrechnung', 'Sonstiges'].map((t) => (
              <div
                key={t}
                className={`topic-tile ${topic === t ? 'selected' : ''}`}
                onClick={() => setTopic(t)}
                // Kein onKeyDown – V6
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="field-group">
          <label htmlFor="message" className="field-label">Nachricht</label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="field-input"
            rows={4}
            placeholder="Ihre Nachricht..."
          />
        </div>

        <div className="form-actions">
          {/*
            V12: Button ist 18x18px – unterschreitet Mindestgröße von 24x24px.
            (layout, WCAG 2.5.8)
          */}
          <button
            onClick={() => setModalOpen(true)}
            className="btn-tiny"
          >
            Senden
          </button>

          {/*
            V7: role="button" auf <div> ohne tabIndex={0}.
            Screenreader erkennt es als Button, aber Tastatur-Fokus ist nicht möglich.
            (semantisch, WCAG 4.1.2)
          */}
          <div
            role="button"
            onClick={() => { setName(''); setMessage(''); setTopic('') }}
            className="btn-fake"
          >
            Zurücksetzen
          </div>
        </div>
      </div>

      {/*
        V8: Modaler Dialog ohne Fokus-Trap.
        Nach dem Öffnen bleibt der Fokus im Hintergrund-Dokument – Tastaturnutzer
        können das Modal nicht schließen und in den Hintergrund-Inhalt navigieren.
        (semantisch, WCAG 2.1.2)
      */}
      {modalOpen && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-box">
            <h2 id="modal-title">Nachricht gesendet</h2>
            <p>Ihre Anfrage wurde erfolgreich übermittelt.</p>
            {/* Kein autoFocus, kein FocusTrap – V8 */}
            <button onClick={() => setModalOpen(false)} className="btn-primary">
              Schließen
            </button>
            {/* Absichtlich weitere fokussierbare Elemente im Hintergrund erreichbar */}
          </div>
        </div>
      )}
    </section>
  )
}
