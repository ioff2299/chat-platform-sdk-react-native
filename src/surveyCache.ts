const cache = new Map<string, Set<string>>()

export function isSurveyEventSeen(contactId: string, messageId: string): boolean {
  return cache.get(contactId)?.has(messageId) ?? false
}

export function markSurveyEventSeen(contactId: string, messageId: string): void {
  if (!cache.has(contactId)) {
    cache.set(contactId, new Set())
  }
  cache.get(contactId)!.add(messageId)
}

export function deleteSurveyEvent(contactId: string, messageId: string): void {
  cache.get(contactId)?.delete(messageId)
}

export function clearSurveyCache(contactId?: string): void {
  if (contactId) {
    cache.delete(contactId)
  } else {
    cache.clear()
  }
}
