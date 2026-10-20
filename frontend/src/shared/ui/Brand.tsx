import { Link } from "react-router-dom";
import { MoveUpRight } from "lucide-react";
import { appName } from "../config/branding";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label={`${appName} — на главную`}>
      <span className="brand-symbol">
        <MoveUpRight strokeWidth={3} />
      </span>
      <span className="brand-name">{appName}</span>
    </Link>
  );
}
