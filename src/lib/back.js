// Android hardware back button: the most recently opened sheet/modal closes first.
import { useEffect, useRef } from "react";

const stack = [];

export function useBackHandler(onBack, enabled = true) {
  const ref = useRef(onBack);
  ref.current = onBack;
  useEffect(() => {
    if (!enabled) return;
    const h = () => ref.current();
    stack.push(h);
    return () => { const i = stack.lastIndexOf(h); if (i >= 0) stack.splice(i, 1); };
  }, [enabled]);
}

// Returns true when a registered handler consumed the press.
export function handleBack() {
  const h = stack[stack.length - 1];
  if (!h) return false;
  h();
  return true;
}
