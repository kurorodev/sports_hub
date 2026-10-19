import { createBrowserRouter } from "react-router-dom";
import { Layout } from "./Layout";
import { CatalogPage } from "../features/events/CatalogPage";
import { EventPage } from "../features/events/EventPage";
import { CreateEventPage } from "../features/events/CreateEventPage";
import { LoginPage } from "../features/session/LoginPage";
import { WorkspacePage } from "../features/session/WorkspacePage";
import { NotFound } from "../shared/ui/Feedback";
import { RouteError } from "./RouteError";
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <CatalogPage /> },
      { path: "/events/new", element: <CreateEventPage /> },
      { path: "/events/:eventId", element: <EventPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/organization", element: <WorkspacePage kind="organization" /> },
      { path: "/admin", element: <WorkspacePage kind="admin" /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
