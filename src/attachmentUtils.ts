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

const AUDIO_EXT = /\.(mp3|m4a|aac|ogg|oga|opus|wav|wave|flac|amr|weba|webm)(\?|#|$)/i
const VIDEO_EXT = /\.(mp4|mov|m4v|mkv|avi|3gp|3gpp)(\?|#|$)/i
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp)(\?|#|$)/i

export function resolveAttachmentType(attachment: ChatAttachment): ChatAttachment['type'] {
  const mime = (attachment.mime ?? '').toLowerCase()
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'

  const name = `${attachment.filename ?? ''} ${attachment.url ?? ''}`
  if (AUDIO_EXT.test(name)) return 'audio'
  if (VIDEO_EXT.test(name)) return 'video'
  if (IMAGE_EXT.test(name)) return 'image'

  return attachment.type ?? 'document'
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
