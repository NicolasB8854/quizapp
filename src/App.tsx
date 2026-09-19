function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-bg-end to-bg-start text-text-main font-sans">
      <header className="border-b border-white/10 px-10 py-6">
        <h1 className="font-serif text-3xl text-accent">
          Quizapp <span className="text-wrong mx-2">·</span>{' '}
          <span className="text-text-main">v0.1</span>
        </h1>
        <p className="text-muted text-sm mt-2">
          Skelett. Hier entsteht der modulare Quizabend-Baukasten.
        </p>
      </header>

      <main className="p-10 max-w-4xl mx-auto">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
          <h2 className="font-serif text-xl text-accent mb-3">Willkommen</h2>
          <p className="text-muted leading-relaxed">
            Dieses Repo ist der Neustart der Quizabend-App. Das Konzept wird
            aktuell mit Freunden abgestimmt. Der nächste Schritt ist,
            gemeinsam mit dem Konzept-Draft die ersten Modi zu bauen.
          </p>
          <p className="text-muted leading-relaxed mt-4">
            Siehe <code className="bg-white/10 px-2 py-0.5 rounded">SPEC.md</code>{' '}
            und <code className="bg-white/10 px-2 py-0.5 rounded">.kiro/steering/</code>{' '}
            für die nächsten Aufgaben.
          </p>
        </div>
      </main>
    </div>
  )
}

export default App
