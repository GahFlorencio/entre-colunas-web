/** Storage scoped to this browser tab. Never used by the service worker. */
export async function getItemAsync(key: string) {
  return sessionStorage.getItem(key);
}
export async function setItemAsync(key: string, value: string) {
  sessionStorage.setItem(key, value);
}
export async function deleteItemAsync(key: string) {
  sessionStorage.removeItem(key);
}
