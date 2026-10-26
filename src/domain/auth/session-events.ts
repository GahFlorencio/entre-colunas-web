type SessionInvalidationListener = (token: string) => void;

const listeners = new Set<SessionInvalidationListener>();

export function invalidateSession(token: string): void {
  for (const listener of listeners) listener(token);
}

export function onSessionInvalidated(
  listener: SessionInvalidationListener,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
