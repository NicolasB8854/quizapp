/// <reference types="vite/client" />

/**
 * Typisierte Environment-Variablen für Vite.
 *
 * Alle `VITE_*`-Präfixe sind zur Build-Zeit als `import.meta.env.VITE_*`
 * verfügbar. Werte kommen aus `.env`, `.env.local` oder aus dem
 * Deploy-System (Amplify Hosting: Environment Variables).
 */
interface ImportMetaEnv {
  /**
   * WebSocket-URL für den quizapp-Multiplayer-Modus.
   * Beispiel: wss://36hzcg1ymb.execute-api.eu-central-1.amazonaws.com/dev
   *
   * Kann leer bleiben — dann läuft die App im reinen Offline-Modus.
   */
  readonly VITE_WS_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
