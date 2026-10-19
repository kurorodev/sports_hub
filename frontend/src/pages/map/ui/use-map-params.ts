import { useCallback, useLayoutEffect, useRef } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

export function useMapParams() {
  const [params, navigate] = useSearchParams();
  const { pathname } = useLocation();
  const current = useRef(params);
  useLayoutEffect(() => {
    current.current = params;
  }, [params]);
  const update = useCallback(
    (
      change: (value: URLSearchParams) => URLSearchParams,
      options?: { replace?: boolean },
    ) => {
      // Browser history can change before React has unmounted this page.
      // A late viewport callback must never add map parameters to the destination.
      if (window.location.pathname !== pathname) return;
      // Delayed map movement must merge into the newest filters, including changes in the same tick.
      const previous = current.current.toString();
      const next = change(new URLSearchParams(current.current));
      if (next.toString() === previous) return;
      current.current = next;
      navigate(next, { ...options, flushSync: true });
    },
    [navigate, pathname],
  );
  return [params, update] as const;
}
