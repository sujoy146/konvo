/**
 * Safe localStorage helpers with try/catch for private browsing / SSR.
 * Keys are namespaced by userId so multiple accounts on the same device don't collide.
 */

export function getUnreadKey(myId: string) {
  return `chat:unread:${myId}`;
}
export function getLastReadKey(myId: string) {
  return `chat:lastRead:${myId}`;
}

export function getUnreadCounts(myId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(getUnreadKey(myId));
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

export function setUnreadCounts(myId: string, counts: Record<string, number>): void {
  try {
    localStorage.setItem(getUnreadKey(myId), JSON.stringify(counts));
  } catch {
    // ignore – private mode
  }
}

export function getLastRead(myId: string): Record<string, string> {
  try {
    const raw = localStorage.getItem(getLastReadKey(myId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function setLastRead(myId: string, lastRead: Record<string, string>): void {
  try {
    localStorage.setItem(getLastReadKey(myId), JSON.stringify(lastRead));
  } catch {
    // ignore – private mode
  }
}
