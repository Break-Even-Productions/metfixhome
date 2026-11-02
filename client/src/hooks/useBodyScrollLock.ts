import { useEffect } from "react";

/** Ref-counted body scroll lock — used by mobile nav (P-E-24). */
let lockCount = 0;
let previousOverflow = "";

function acquireLock(): void {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function releaseLock(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

/**
 * Locks `document.body` scroll while `locked` is true.
 * Multiple callers share one lock via ref-count.
 */
export function useBodyScrollLock(locked: boolean): void {
  useEffect(() => {
    if (!locked) return;
    acquireLock();
    return () => releaseLock();
  }, [locked]);
}
