// Minimal test double for `next/server`. The route handlers only need a request
// with `.url` / `.json()` and `NextResponse.json(body, { status })`, so we avoid
// pulling Next's edge runtime into the node:test process.
export class NextRequest {
  url: string
  bodyValue: unknown
  constructor(url: string, init?: { body?: unknown }) {
    this.url = url
    this.bodyValue = init?.body
  }
  json(): Promise<unknown> {
    return Promise.resolve(this.bodyValue)
  }
}

interface FakeResponse {
  status: number
  body: unknown
  json(): Promise<unknown>
}

export const NextResponse = {
  json(body: unknown, init?: { status?: number }): FakeResponse {
    return {
      status: init?.status ?? 200,
      body,
      json() {
        return Promise.resolve(body)
      },
    }
  },
}
