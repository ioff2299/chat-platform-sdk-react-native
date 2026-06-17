import type { AttachmentInput } from './types'

export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|heic|heif|bmp|svg|avif)$/i
const TEXT_EXT = /\.(txt|csv|log|md|markdown|json|xml|html?|css|js|jsx|ts|tsx|rtf|ya?ml|ini|conf|tsv)$/i

export function isAllowedAttachment(file: AttachmentInput): boolean {
  const mime = (file.type ?? '').toLowerCase()
  if (mime.startsWith('image/') || mime.startsWith('text/')) return true

  const name = (file.name ?? '').trim()
  return IMAGE_EXT.test(name) || TEXT_EXT.test(name)
}

function shortName(name: string): string {
  const n = (name ?? '').trim() || 'файл'
  return n.length > 20 ? `${n.slice(0, 20)}…` : n
}

function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(0)} МБ`
}

export interface AttachmentValidationResult {
  accepted: AttachmentInput[]
  errors: string[]
}

export function validateAttachments(files: AttachmentInput[]): AttachmentValidationResult {
  const accepted: AttachmentInput[] = []
  const errors: string[] = []

  for (const file of files) {
    const size = file.size ?? 0
    if (size > MAX_ATTACHMENT_SIZE) {
      errors.push(
        `Файл «${shortName(file.name)}» превышает ${formatMb(MAX_ATTACHMENT_SIZE)} и не будет отправлен.`,
      )
      continue
    }

    if (!isAllowedAttachment(file)) {
      errors.push(
        `Файл «${shortName(file.name)}» имеет недопустимый тип. Можно отправлять только изображения и текстовые файлы.`,
      )
      continue
    }

    accepted.push(file)
  }

  return { accepted, errors }
}