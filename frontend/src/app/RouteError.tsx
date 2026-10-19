import { useRouteError } from "react-router-dom";
import { ErrorState } from "../shared/ui/Feedback";

export function RouteError() {
  const error = useRouteError();
  return (
    <main className="container page-state">
      <ErrorState error={error} retry={() => window.location.reload()} />
    </main>
  );
}
