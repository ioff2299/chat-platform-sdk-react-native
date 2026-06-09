import { ChatSDK } from './ChatSDK'
import type { ChatAttachment, GalleryAttachment } from './types'

export function attachmentDisplayName(attachment: ChatAttachment): string {
  const name = attachment.filename?.trim()
  if (name) return name

  try {
    const path = attachment.url.split('?')[0] ?? ''
    const segment = path.split('/').pop()
    if (segment) return decodeURIComponent(segment)
  } catch {
    // ignore malformed URL
  }

  return 'Файл'
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_') || 'file'
}

export interface AttachmentDownloadRequest {
  downloadUrl: string
  filename: string
  headers: Record<string, string>
  mime: string
}

export function buildAttachmentDownloadRequest(
  attachment: GalleryAttachment,
): AttachmentDownloadRequest {
  const api = ChatSDK.getApi()
  const contactId = api.getContactId()
  if (!contactId) {
    throw new Error('Сессия не активна')
  }

  const filename = attachmentDisplayName(attachment)

  return {
    downloadUrl: api.buildAttachmentDownloadUrl(attachment.url, filename),
    filename,
    headers: api.getAuthHeaders(),
    mime: attachment.mime || 'application/octet-stream',
  }
}

export type AttachmentDownloadHandler = (attachment: GalleryAttachment) => Promise<void>
