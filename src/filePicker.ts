import FilePicker from './native/NativeChatSdkFilePicker'
import type { AttachmentInput } from './types'

/** Открывает системный пикер файлов. Возвращает null если пользователь отменил выбор. */
export async function pickFiles(): Promise<AttachmentInput[] | null> {
  if (!FilePicker) {
    throw new Error(
      'ChatSDK: нативный модуль ChatSdkFilePicker не подключён. ' +
      'Пересоберите приложение (Android: ./gradlew clean; iOS: pod install).',
    )
  }

  const picked = await FilePicker.pick({ multiple: true, mimeFilter: ['image/*', 'text/*'] })
  if (!picked || picked.length === 0) return null

  return picked.map((f) => ({
    uri: f.uri,
    name: f.name,
    type: f.mime || 'application/octet-stream',
    size: f.size > 0 ? f.size : undefined,
  }))
}
