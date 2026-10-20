import { tr } from "../i18n/translate";
import { useLocale } from "../i18n/use-preferences";
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
  useLocale();
  return (
    <nav className="activity-view-switch" aria-label={tr("Вид активностей")}>
      <Link
        to={activityViewHref("list", params)}
        aria-current={view === "list" ? "page" : undefined}
      >
        <List size={18} />
        {tr(" Список")}
      </Link>
      <Link
        to={activityViewHref("map", params)}
        aria-current={view === "map" ? "page" : undefined}
      >
        <Map size={18} />
        {tr(" На карте")}
      </Link>
    </nav>
  );
}
