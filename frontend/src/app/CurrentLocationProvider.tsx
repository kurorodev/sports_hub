import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CurrentLocationContext } from "../shared/lib/current-location-context";
import { hasPoint, type Point } from "../shared/lib/map";

export function CurrentLocationProvider({ children }: { children: ReactNode }) {
  const [position, setPosition] = useState<Point | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "locating" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const watch = useRef<number | null>(null);
  const revision = useRef(0);
  const clear = useCallback(() => {
    revision.current++;
    if (watch.current !== null)
      navigator.geolocation?.clearWatch(watch.current);
    watch.current = null;
  }, []);
  useEffect(() => clear, [clear]);
  const stop = useCallback(() => {
    clear();
    setPosition(null);
    setAccuracy(null);
    setError("");
    setStatus("idle");
  }, [clear]);
  const request = useCallback(() => {
    clear();
    setPosition(null);
    setAccuracy(null);
    setError("");
    if (window.isSecureContext === false || !navigator.geolocation) {
      setStatus("error");
      setError(
        window.isSecureContext === false
          ? "Для геолокации откройте сайт по HTTPS или на localhost."
          : "Этот браузер не поддерживает геолокацию.",
      );
      return;
    }
    setStatus("locating");
    const current = revision.current;
    const fail = (message: string) => {
      if (current !== revision.current) return;
      clear();
      setPosition(null);
      setAccuracy(null);
      setStatus("error");
      setError(message);
    };
    try {
      watch.current = navigator.geolocation.watchPosition(
        ({ coords }) => {
          if (current !== revision.current) return;
          const point = {
            latitude: Number(coords.latitude.toFixed(5)),
            longitude: Number(coords.longitude.toFixed(5)),
          };
          if (!hasPoint({ ...point, city: "", address: "" })) {
            fail("Не удалось получить координаты. Повторите попытку.");
            return;
          }
          setPosition((previous) =>
            previous?.latitude === point.latitude &&
            previous.longitude === point.longitude
              ? previous
              : point,
          );
          setAccuracy(
            Number.isFinite(coords.accuracy)
              ? Math.round(coords.accuracy)
              : null,
          );
          setStatus("ready");
          setError("");
        },
        (failure) => {
          if (current !== revision.current) return;
          if (failure.code === 1) {
            fail(
              "Доступ к геолокации запрещён. Разрешите его в настройках браузера и повторите попытку.",
            );
          } else {
            // При временной потере GPS ждём следующую координату, не отключая отслеживание.
            setPosition(null);
            setAccuracy(null);
            setStatus("error");
            setError(
              "Сигнал геолокации временно недоступен. Ожидаем обновления; можно повторить попытку.",
            );
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    } catch {
      fail("Не удалось включить геолокацию. Проверьте разрешения браузера.");
    }
  }, [clear]);
  return (
    <CurrentLocationContext.Provider
      value={{ position, accuracy, status, error, request, stop }}
    >
      {children}
    </CurrentLocationContext.Provider>
  );
}
