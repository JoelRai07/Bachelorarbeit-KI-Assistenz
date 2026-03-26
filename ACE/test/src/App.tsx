import { useState } from 'react'
import LoginForm from './components/LoginForm'
import ContactForm from './components/ContactForm'
import './styles.css'

/**
 * ACE Synthetische Testkomponente
 * ==================================
 * Dieses Mini-Projekt simuliert eine realistische Web-App mit zwei Seiten.
 * Es enthält 12 bewusst eingebaute WCAG-Violations zur Evaluation des ACE-PoC.
 *
 * Violations-Übersicht:
 * ┌────┬──────────────────────────────────────────┬─────────────┬─────────────────────┬──────────┐
 * │ #  │ Violation                                │ Kategorie   │ Erwartete Quelle    │ WCAG     │
 * ├────┼──────────────────────────────────────────┼─────────────┼─────────────────────┼──────────┤
 * │ V1 │ <img> ohne alt-Attribut                  │ syntaktisch │ axe-core            │ 1.1.1    │
 * │ V2 │ <button> ohne Label                      │ syntaktisch │ axe-core            │ 4.1.2    │
 * │ V3 │ Input ohne <label>                       │ syntaktisch │ axe-core            │ 1.3.1    │
 * │ V4 │ Kontrast < 4.5:1                         │ layout      │ axe-core            │ 1.4.3    │
 * │ V5 │ outline: none (Fokus entfernt)           │ layout      │ axe-core+Playwright │ 2.4.7    │
 * │ V6 │ onClick ohne onKeyDown                   │ semantisch  │ grep                │ 2.1.1    │
 * │ V7 │ role="button" auf div ohne tabIndex      │ semantisch  │ axe-core+grep       │ 4.1.2    │
 * │ V8 │ Modaler Dialog ohne Fokus-Trap           │ semantisch  │ Playwright          │ 2.1.2    │
 * │ V9 │ Skip-Link fehlt                          │ semantisch  │ Playwright          │ 2.4.1    │
 * │V10 │ aria-hidden auf fokussierbarem Element   │ syntaktisch │ axe-core            │ 4.1.2    │
 * │V11 │ DOM-Reihenfolge weicht von visuell ab    │ semantisch  │ axe-core            │ 1.3.2    │
 * │V12 │ Interaktives Element < 24x24px           │ layout      │ grep (CSS-Pattern)  │ 2.5.8    │
 * └────┴──────────────────────────────────────────┴─────────────┴─────────────────────┴──────────┘
 */

type Page = 'login' | 'contact'

export default function App() {
  const [page, setPage] = useState<Page>('login')

  return (
    <div className="app">
      {/* V9: Skip-Link fehlt bewusst – kein <a href="#main-content">Zum Inhalt springen</a> */}

      <header className="app-header">
        {/* V1: Logo-Bild ohne alt-Attribut (syntaktisch, WCAG 1.1.1) */}
        <img src="https://placehold.co/120x40/0057B8/white" className="logo" />

        <nav>
          {/* V11: Visuelle Reihenfolge im CSS (flex-direction: row-reverse) weicht von DOM-Reihenfolge ab */}
          <ul className="nav-list reversed-nav">
            <li>
              <button
                className={`nav-btn ${page === 'login' ? 'active' : ''}`}
                onClick={() => setPage('login')}
              >
                Login
              </button>
            </li>
            <li>
              <button
                className={`nav-btn ${page === 'contact' ? 'active' : ''}`}
                onClick={() => setPage('contact')}
              >
                Kontakt
              </button>
            </li>
          </ul>
        </nav>
      </header>

      <main id="main-content" className="app-main">
        {page === 'login' ? <LoginForm /> : <ContactForm />}
      </main>

      <footer className="app-footer">
        <p>ACE Synthetische Testkomponente – Nur für Evaluationszwecke</p>
      </footer>
    </div>
  )
}
