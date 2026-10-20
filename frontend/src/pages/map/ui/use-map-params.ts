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
      // URL меняется раньше размонтирования страницы; позднее событие карты не должно менять новый маршрут.
      if (window.location.pathname !== pathname) return;
      // Берём последние фильтры, иначе отложенное движение карты затрёт недавний выбор.
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
