import { useCallback, useLayoutEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export function useMapParams() {
  const [params, navigate] = useSearchParams();
  const current = useRef(params);
  useLayoutEffect(() => {
    current.current = params;
  }, [params]);
  const update = useCallback(
    (
      change: (value: URLSearchParams) => URLSearchParams,
      options?: { replace?: boolean },
    ) => {
      // Delayed map movement must merge into the newest filters, including changes in the same tick.
      const next = change(current.current);
      current.current = next;
      navigate(next, { ...options, flushSync: true });
    },
    [navigate],
  );
  return [params, update] as const;
}
