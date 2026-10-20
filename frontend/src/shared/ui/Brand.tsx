import { usePreferences } from "../i18n/use-preferences";
import { tr } from "../i18n/translate";
import { Link } from "react-router-dom";
import { appName } from "../config/branding";

export function Brand({ onDark = false }: { onDark?: boolean }) {
  const { theme } = usePreferences();
  return (
    <Link
      className="brand"
      to="/"
      aria-label={tr("{0} — на главную", [appName])}
    >
      <img
        className="brand-logo"
        src={`/images/brand/stechenie-logo-on-${onDark || theme === "dark" ? "dark" : "light"}.png`}
        alt=""
        width="2048"
        height="692"
      />
    </Link>
  );
}
