import { useEffect } from "react";
import { appName } from "../config/branding";
import { useLocale } from "./use-preferences";
import { tr } from "./translate";
export function InterfaceMetadata() {
  const locale = useLocale();
  useEffect(() => {
    document.title = `${appName} — ${tr("Спорт начинается с компании.")}`;
  }, [locale]);
  return null;
}
