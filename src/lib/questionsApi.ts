/**
 * HTTP-Client für die Fragen-CRUD-API.
 *
 * Endpoints (siehe server/src/handlers/http.ts):
 *   GET    /questions          → { questions: Question[], count: number }
 *   GET    /questions/:id      → { question: Question } | 404
 *   POST   /questions          → { question: Question }  (Server generiert id)
 *   PUT    /questions/:id      → { question: Question }
 *   DELETE /questions/:id      → { ok: true, id }
 *
 * Basis-URL kommt aus `VITE_HTTP_URL`. Wenn nicht gesetzt: alle Aufrufe
 * werfen sofort (statt zufälliger Netzwerk-Fehler). Der Editor prüft
 * das UI-seitig und zeigt einen Setup-Hinweis.
 */

import type { Question } from '@quizapp/shared'

const BASE = import.meta.env.VITE_HTTP_URL

function requireBase(): string {
  if (!BASE) {
    throw new Error(
      'VITE_HTTP_URL nicht gesetzt. Trag den Terraform-Output http_endpoint in .env.local ein.',
    )
  }
  return BASE
}

async function jsonRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${requireBase()}${path}`
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* ignore parse errors */
    }
    const detail =
      body && typeof body === 'object' && 'error' in body
        ? String((body as { error: unknown }).error)
        : `${res.status} ${res.statusText}`
    throw new Error(`HTTP ${res.status}: ${detail}`)
  }
  return (await res.json()) as T
}

export async function listQuestions(): Promise<Question[]> {
  const data = await jsonRequest<{ questions: Question[]; count: number }>(
    '/questions',
  )
  return data.questions
}

export async function getQuestion(id: string): Promise<Question> {
  const data = await jsonRequest<{ question: Question }>(
    `/questions/${encodeURIComponent(id)}`,
  )
  return data.question
}

export async function createQuestion(input: Question): Promise<Question> {
  const data = await jsonRequest<{ question: Question }>('/questions', {
    method: 'POST',
    body: JSON.stringify(input),
  })
  return data.question
}

export async function updateQuestion(
  id: string,
  input: Question,
): Promise<Question> {
  const data = await jsonRequest<{ question: Question }>(
    `/questions/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(input) },
  )
  return data.question
}

export async function deleteQuestion(id: string): Promise<void> {
  await jsonRequest<{ ok: true; id: string }>(
    `/questions/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
}

/** Ob die API überhaupt konfiguriert ist (für UI-Guards). */
export function isEditingConfigured(): boolean {
  return !!BASE
}
