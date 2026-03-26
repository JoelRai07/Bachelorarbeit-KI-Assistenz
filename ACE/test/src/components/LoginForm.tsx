import { useState } from 'react'

/**
 * LoginForm – enthält folgende Violations:
 *   V2:  Schließen-Button ohne Label (syntaktisch, WCAG 4.1.2)
 *   V3:  Passwort-Input ohne <label> (syntaktisch, WCAG 1.3.1)
 *   V4:  Submit-Button mit zu niedrigem Kontrast (#888 auf #fff) (layout, WCAG 1.4.3)
 *   V5:  Fokus-Outline via inline-style entfernt (layout, WCAG 2.4.7)
 *   V10: aria-hidden="true" auf fokussierbarem Hilfe-Link (syntaktisch, WCAG 4.1.2)
 */
export default function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showInfo, setShowInfo] = useState(false)

  const handleSubmit = () => {
    alert(`Login mit: ${email}`)
  }

  return (
    <section className="form-container">
      <h1 className="form-title">Anmelden</h1>

      <div className="form-body">
        {/* E-Mail: korrekt mit Label (bewusster Kontrast zu V3) */}
        <div className="field-group">
          <label htmlFor="email" className="field-label">
            E-Mail-Adresse
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field-input"
            placeholder="name@beispiel.de"
          />
        </div>

        {/* V3: Passwort-Input ohne zugehöriges <label> (WCAG 1.3.1) */}
        <div className="field-group">
          {/* Kein <label> vorhanden – nur visueller Placeholder */}
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="field-input"
            placeholder="Passwort eingeben"
          />
        </div>

        <div className="form-actions">
          {/* V4: Kontrastverhältnis ~2.5:1 – schlechter Kontrast (WCAG 1.4.3) */}
          <button
            onClick={handleSubmit}
            className="btn-submit-lowcontrast"
          >
            Anmelden
          </button>

          {/* V2: Icon-Button ohne aria-label und ohne sichtbaren Text (WCAG 4.1.2) */}
          <button
            className="btn-icon"
            onClick={() => setShowInfo(!showInfo)}
          >
            ?
          </button>
        </div>

        {showInfo && (
          <div className="info-box">
            <p>Bitte verwenden Sie Ihre BITBW-Zugangsdaten.</p>
          </div>
        )}

        {/* V5: Fokus-Outline entfernt via style-Prop (WCAG 2.4.7) */}
        {/* V10: aria-hidden="true" auf fokussierbarem <a>-Element (WCAG 4.1.2) */}
        <div className="form-footer-links">
          <a
            href="#reset"
            style={{ outline: 'none' }}
            aria-hidden="true"
            tabIndex={0}
          >
            Passwort vergessen?
          </a>
        </div>
      </div>
    </section>
  )
}
