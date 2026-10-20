import { Link } from "react-router-dom";
import { appName } from "../config/branding";

export function Brand({ onDark = false }: { onDark?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label={`${appName} — на главную`}>
      <img
        className="brand-logo"
        src={`/images/brand/stechenie-logo-on-${onDark ? "dark" : "light"}.png`}
        alt=""
        width="2048"
        height="692"
      />
    </Link>
  );
}
