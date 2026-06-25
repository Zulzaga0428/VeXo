/**
 * Browser notification helpers for VexoAI.
 *
 * requestNotifyPermission  — call when the user starts a long job so the
 *                            browser can ask for permission up-front rather
 *                            than mid-generation.
 * sendVideoReadyNotification — call when a generation run finishes; fires a
 *                              native OS notification (if granted) so the user
 *                              knows their video is ready even if they switched
 *                              to another tab.
 */

export function requestNotifyPermission(): void {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission === "default") {
    void Notification.requestPermission()
  }
}

export function sendVideoReadyNotification(title: string): void {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try {
    new Notification("VexoAI — Видео бэлэн боллоо! 🎬", {
      body: title || "Таны видео үүслэл дуусав.",
      icon: "/vexo-logo.png",
    })
  } catch {
    // Some environments (e.g. Firefox private mode) throw even when permission
    // is "granted" — swallow silently so it never breaks the generation flow.
  }
}

/**
 * Briefly flashes the document title so the user notices in a background tab
 * even without notification permission.  Restores the original title after
 * `durationMs` (default 8 s).
 */
export function flashTabTitle(message: string, durationMs = 8000): void {
  if (typeof document === "undefined") return
  const original = document.title
  document.title = message
  setTimeout(() => {
    document.title = original
  }, durationMs)
}
