// Keep a no-op message listener during initial evaluation to satisfy
// browser worker requirements used by some push SDK internals.
self.addEventListener("message", function () {});
// OneSignal integration is suspended intentionally.
