import ImageCompressor from './native/NativeChatSdkImageCompressor'
import type { AttachmentInput } from './types'

const COMPRESSIBLE_MIME = /^image\/(jpe?g|png|heic|heif|webp|bmp)$/i
const COMPRESSIBLE_EXT = /\.(jpe?g|png|heic|heif|webp|bmp)$/i

export interface CompressImageOptions {
  maxSize?: number
  quality?: number
}

const DEFAULTS: Required<CompressImageOptions> = { maxSize: 1600, quality: 0.7 }

function isCompressible(file: AttachmentInput): boolean {
  const mime = (file.type ?? '').toLowerCase()
  if (mime.startsWith('image/')) return COMPRESSIBLE_MIME.test(mime)
  return COMPRESSIBLE_EXT.test((file.name ?? '').trim())
}

function toJpegName(name: string | undefined): string {
  const base = (name ?? '').trim() || 'image'
  const dot = base.lastIndexOf('.')
  const stem = dot > 0 ? base.slice(0, dot) : base
  return `${stem}.jpg`
}

async function compressOne(
  file: AttachmentInput,
  options: Required<CompressImageOptions>,
): Promise<AttachmentInput> {
  if (!ImageCompressor || !file.uri || !isCompressible(file)) return file

  try {
    const out = await ImageCompressor.compress({
      uri: file.uri,
      maxSize: options.maxSize,
      quality: options.quality,
    })
    if (!out || out.size <= 0) return file
    if (typeof file.size === 'number' && file.size > 0 && out.size >= file.size) return file

    return {
      uri: out.uri,
      name: toJpegName(file.name),
      type: out.mime || 'image/jpeg',
      size: out.size,
    }
  } catch {
    return file
  }
}

export async function compressAttachments(
  files: AttachmentInput[],
  options?: CompressImageOptions,
): Promise<AttachmentInput[]> {
  if (!ImageCompressor || files.length === 0) return files
  const opts = { ...DEFAULTS, ...options }
  return Promise.all(files.map((f) => compressOne(f, opts)))
}

export const isImageCompressorAvailable = (): boolean => ImageCompressor != null