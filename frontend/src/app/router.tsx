import { ProfilePage } from "../pages/profile";
import { RegisterPage } from "../pages/register";
import { Navigate, createBrowserRouter } from "react-router-dom";
import { OrganizationsPage, OrganizationPage } from "../pages/organizations";
import { Layout } from "./Layout";
import { CatalogPage } from "../pages/catalog";
import { EventPage } from "../pages/event";
import { CreateEventPage } from "../pages/create-event";
import { LoginPage } from "../pages/login";
import { WorkspacePage } from "../pages/workspace";
import { NotFound } from "../shared/ui/Feedback";
import { RouteError } from "./RouteError";
import { SupportPage } from "../pages/support";
export const router = createBrowserRouter([
  {
    element: <Layout />,
    errorElement: <RouteError />,
    children: [
      { path: "/", element: <CatalogPage /> },
      {
        path: "/map",
        lazy: async () => ({
          Component: (await import("../pages/map")).MapPage,
        }),
      },
      { path: "/events/new", element: <CreateEventPage /> },
      { path: "/events/:eventId", element: <EventPage /> },
      { path: "/login", element: <LoginPage /> },
      { path: "/register", element: <RegisterPage /> },
      { path: "/profile", element: <ProfilePage own /> },
      { path: "/support", element: <SupportPage /> },
      { path: "/support/new", element: <SupportPage create /> },
      { path: "/support/:ticketId", element: <SupportPage /> },
      { path: "/users/:userId", element: <ProfilePage /> },
      { path: "/organizations", element: <OrganizationsPage /> },
      { path: "/organizations/:organizationId", element: <OrganizationPage /> },
      {
        path: "/organization",
        element: <Navigate to="/organizations?view=mine" replace />,
      },
      { path: "/admin", element: <WorkspacePage /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
