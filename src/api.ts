import type {
  SessionResponse,
  MobileConfig,
  MessagesResponse,
  ChatSDKDevice,
  SurveyConfigResponse,
  AttachmentInput,
} from './types'

export class MobileApiClient {
  private baseUrl: string
  private token: string
  private sessionToken: string | null = null
  private contactId: string | null = null
  private userProfile: Record<string, string | undefined> = {}

  constructor(baseUrl: string, token: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.token = token
  }

  setSession(sessionToken: string, contactId: string): void {
    this.sessionToken = sessionToken
    this.contactId = contactId
  }

  setUserProfile(profile: Record<string, string | undefined>): void {
    this.userProfile = profile
  }

  clearSession(): void {
    this.sessionToken = null
    this.contactId = null
    this.userProfile = {}
  }

  getContactId(): string | null {
    return this.contactId
  }

  async createSession(
    userId: string,
    profile: Record<string, string | undefined>,
    device: ChatSDKDevice,
  ): Promise<SessionResponse> {
    const body = { userId, profile, device }
    const path = `/api/mobile/${this.token}/session`
    let lastError: Error | null = null

    // До 3 попыток — tunnel/LTE иногда рвёт POST
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await this.post(path, body, 60_000)
        return res as SessionResponse
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e))
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
        }
      }
    }

    throw lastError ?? new Error('Session request failed')
  }

  async getConfig(): Promise<MobileConfig> {
    const res = await this.get(`/api/mobile/${this.token}/config`)
    return res as MobileConfig
  }

  async getMessages(): Promise<MessagesResponse> {
    this.assertSession()
    const res = await this.get(
      `/api/mobile/${this.token}/contact/${this.contactId}/messages`,
    )
    return res as MessagesResponse
  }

  async startDialog(userData: Record<string, string | undefined>): Promise<void> {
    this.assertSession()
    await this.post(
      `/api/mobile/${this.token}/contact/${this.contactId}/start`,
      userData,
    )
  }

  async sendMessage(text: string, files?: AttachmentInput[]): Promise<void> {
    this.assertSession()
    const url = `${this.baseUrl}/api/mobile/${this.token}/contact/${this.contactId}/messages`

    try {
      await this.postMessageForm(url, await this.buildMessageForm(text, files, false))
    } catch (e) {
      if (files && files.length > 0 && isFormDataPartError(e)) {
        await this.postMessageForm(url, await this.buildMessageForm(text, files, true))
      } else {
        throw e
      }
    }
  }

  private async buildMessageForm(
    text: string,
    files: AttachmentInput[] | undefined,
    asBlob: boolean,
  ): Promise<FormData> {
    const form = new FormData()
    if (text.trim()) form.append('text', text)

    if (files && files.length > 0) {
      for (const f of files) {
        await appendFile(form, f, asBlob)
      }
    }

    if (this.userProfile.name)    form.append('name',    this.userProfile.name)
    if (this.userProfile.surname) form.append('surname', this.userProfile.surname)
    if (this.userProfile.email)   form.append('email',   this.userProfile.email)
    if (this.userProfile.phone)   form.append('phone',   this.userProfile.phone)

    return form
  }

  private async postMessageForm(url: string, form: FormData): Promise<void> {
    const res = await fetch(url, {
      method: 'POST',
      headers: this.authHeaders(),
      body: form,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? `HTTP ${res.status}`)
    }
  }

  async getSurveyConfig(closeEventCreatedAt?: number): Promise<SurveyConfigResponse> {
    const params = new URLSearchParams()
    if (this.contactId) {
      params.set('contact_id', this.contactId)
    }
    if (closeEventCreatedAt !== undefined) {
      params.set('close_event_at', String(closeEventCreatedAt))
    }
    const query = params.toString()
    const res = await this.get(
      `/api/mobile/${this.token}/survey-config${query ? `?${query}` : ''}`,
    )
    return res as SurveyConfigResponse
  }

  async submitCsi(rating: number, comment?: string): Promise<void> {
    this.assertSession()
    await this.post(
      `/api/mobile/${this.token}/contact/${this.contactId}/csi`,
      { rating, comment: comment ?? '' },
    )
  }

  async sendCallback(messageId: number, callbackData: string): Promise<void> {
    this.assertSession()
    await this.post(
      `/api/mobile/${this.token}/contact/${this.contactId}/callback`,
      { message_id: messageId, callback_data: callbackData },
    )
  }

  async registerPushToken(deviceToken: string, platform: 'fcm' | 'apns'): Promise<void> {
    this.assertSession()
    await this.post(
      `/api/mobile/${this.token}/contact/${this.contactId}/push-token`,
      { device_token: deviceToken, platform },
    )
  }

  async deletePushToken(deviceToken: string): Promise<void> {
    this.assertSession()
    await this.del(
      `/api/mobile/${this.token}/contact/${this.contactId}/push-token`,
      { device_token: deviceToken },
    )
  }

  getDownloadUrl(contactId: string): string {
    return `${this.baseUrl}/api/mobile/${this.token}/contact/${contactId}/download`
  }

  buildAttachmentDownloadUrl(fileUrl: string, filename: string): string {
    this.assertSession()
    const params = new URLSearchParams({
      url: fileUrl,
      filename: filename || 'file',
    })
    return `${this.getDownloadUrl(this.contactId!)}?${params.toString()}`
  }

  getBroadcastAuthEndpoint(): string {
    return `${this.baseUrl}/api/mobile/${this.token}/broadcasting/auth`
  }

  getAuthHeaders(): Record<string, string> {
    return this.authHeaders()
  }

  private assertSession(): void {
    if (!this.sessionToken || !this.contactId) {
      throw new Error('ChatSDK: not authenticated. Call login() first.')
    }
  }

  private authHeaders(): Record<string, string> {
    return this.sessionToken
      ? { Authorization: `Bearer ${this.sessionToken}` }
      : {}
  }

  private async get(path: string): Promise<unknown> {
    const res = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
      headers: { Accept: 'application/json', ...this.authHeaders() },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  private async post(path: string, body: unknown, timeoutMs = 30_000): Promise<unknown> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.authHeaders(),
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.message ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  private async del(path: string, body: unknown, timeoutMs = 30_000): Promise<unknown> {
    const res = await this.fetchWithTimeout(
      `${this.baseUrl}${path}`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...this.authHeaders(),
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
    )
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json?.message ?? `HTTP ${res.status}`)
    }
    return res.json()
  }

  private async fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 30000): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { ...options, signal: controller.signal })
    } catch (e: unknown) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw new Error(`Request timed out: ${url}`)
      }
      throw e
    } finally {
      clearTimeout(timer)
    }
  }
}

async function appendFile(
  form: FormData,
  f: AttachmentInput,
  asBlob: boolean,
): Promise<void> {
  let uri = (f.uri ?? '').trim()
  if (!uri) return
  if (uri.startsWith('/')) uri = `file://${uri}`
  const name = f.name || 'file'
  const type = f.type || 'application/octet-stream'

  if (asBlob) {
    const blob = await uriToBlob(uri)
    const typed = blob.type === type ? blob : new Blob([blob], { type })
    form.append('files[]', typed, name)
  } else {
    form.append('files[]', { uri, name, type } as unknown as Blob)
  }
}

function uriToBlob(uri: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.responseType = 'blob'
    xhr.onload = () => resolve(xhr.response as Blob)
    xhr.onerror = () => reject(new Error(`ChatSDK: не удалось прочитать файл ${uri}`))
    xhr.open('GET', uri, true)
    xhr.send(null)
  })
}

function isFormDataPartError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /FormData ?Part|Format ?Data ?Part/i.test(msg)
}
