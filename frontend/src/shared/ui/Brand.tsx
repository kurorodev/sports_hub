import { Link } from "react-router-dom";
import { MoveUpRight } from "lucide-react";

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="ДВИЖ — на главную">
      <span className="brand-symbol">
        <MoveUpRight strokeWidth={3} />
      </span>
      <span>движ</span>
      <span className="brand-dot">•</span>
    </Link>
  );
}
