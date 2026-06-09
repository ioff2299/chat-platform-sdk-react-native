import {
  attachmentDisplayName,
  buildAttachmentDownloadRequest,
  sanitizeFilename,
  type AttachmentDownloadHandler,
} from '../attachmentUtils'
import Downloader from '../native/NativeChatSdkDownloader'
import type { GalleryAttachment } from '../types'

export const defaultAttachmentDownloader: AttachmentDownloadHandler = async (
  attachment: GalleryAttachment,
) => {
  if (!Downloader) {
    throw new Error(
      'ChatSDK: нативный модуль ChatSdkDownloader не подключён. ' +
      'Пересоберите приложение (Android: ./gradlew clean; iOS: pod install).',
    )
  }

  const { downloadUrl, filename, headers, mime } = buildAttachmentDownloadRequest(attachment)
  await Downloader.download({
    url: downloadUrl,
    filename: sanitizeFilename(filename) || attachmentDisplayName(attachment),
    mime: mime || 'application/octet-stream',
    headers,
  })
}
