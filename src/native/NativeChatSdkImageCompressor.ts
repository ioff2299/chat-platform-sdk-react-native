import { NativeModules, TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

export interface CompressOptions {
  uri: string
  maxSize?: number
  quality?: number
}

export interface CompressedImage {
  uri: string
  mime: string
  size: number
  width: number
  height: number
}

export interface Spec extends TurboModule {
  compress(options: CompressOptions): Promise<CompressedImage>
}

const MODULE_NAME = 'ChatSdkImageCompressor'

function loadModule(): Spec | null {
  try {
    return TurboModuleRegistry.get<Spec>(MODULE_NAME)
  } catch {
    return (NativeModules[MODULE_NAME] as Spec | undefined) ?? null
  }
}

export default loadModule()