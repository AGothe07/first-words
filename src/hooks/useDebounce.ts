import { useRef, useCallback } from "react";

export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as T;
}

export function useThrottle<T extends (...args: any[]) => any>(fn: T, delay: number = 1000) {
  const lastCall = useRef(0);
  const pending = useRef(false);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall.current >= delay && !pending.current) {
      pending.current = true;
      lastCall.current = now;
      Promise.resolve(fn(...args)).finally(() => {
        pending.current = false;
      });
    }
  }, [fn, delay]) as T;
}
