import { List, Map } from "lucide-react";
import { Link } from "react-router-dom";
import { activityViewHref } from "../lib/activity-navigation";

export function ActivityViewSwitch({
  view,
  params,
}: {
  view: "list" | "map";
  params: URLSearchParams;
}) {
  return (
    <nav className="activity-view-switch" aria-label="Вид активностей">
      <Link
        to={activityViewHref("list", params)}
        aria-current={view === "list" ? "page" : undefined}
      >
        <List size={18} /> Список
      </Link>
      <Link
        to={activityViewHref("map", params)}
        aria-current={view === "map" ? "page" : undefined}
      >
        <Map size={18} /> На карте
      </Link>
    </nav>
  );
}
