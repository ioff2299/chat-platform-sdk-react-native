import { NativeModules, TurboModuleRegistry } from 'react-native'
import type { TurboModule } from 'react-native'

export interface PickedFile {
  uri: string
  name: string
  mime: string
  size: number
}

export interface PickOptions {
  multiple: boolean
  mimeFilter?: string[]
}

export interface Spec extends TurboModule {
  pick(options: PickOptions): Promise<PickedFile[] | null>
}

const MODULE_NAME = 'ChatSdkFilePicker'

function loadModule(): Spec | null {
  try {
    return TurboModuleRegistry.get<Spec>(MODULE_NAME)
  } catch {
    return (NativeModules[MODULE_NAME] as Spec | undefined) ?? null
  }
}

export default loadModule()
