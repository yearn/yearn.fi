export async function disableServiceWorkerDev(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const regs = await navigator.serviceWorker.getRegistrations()
    await Promise.all(
      regs.map(async (r) => {
        try {
          await r.unregister()
        } catch {}
      })
    )
  } catch {}

  // Best-effort: clear common Workbox caches that may interfere with CORS
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('workbox') || k.includes('runtime') || k.includes('precache'))
          .map((k) => caches.delete(k))
      )
    }
  } catch {}
}
