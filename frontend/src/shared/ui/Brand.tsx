import { Link } from "react-router-dom";
import { MoveUpRight } from "lucide-react";
import { appName } from "../config/branding";

export function Brand({ homeMark = false }: { homeMark?: boolean }) {
  return (
    <Link className="brand" to="/" aria-label={`${appName} — на главную`}>
      <span className="brand-symbol">
        {homeMark ? (
          <img
            className="brand-home-mark"
            src="/images/brand/home-100-mark.png"
            alt=""
            width="35"
            height="35"
          />
        ) : (
          <MoveUpRight strokeWidth={3} />
        )}
      </span>
      <span className="brand-name">{appName}</span>
    </Link>
  );
}
