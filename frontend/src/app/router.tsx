import { ProfilePage } from "../pages/profile";
import { RegisterPage } from "../pages/register";
import { createBrowserRouter } from "react-router-dom";
import { OrganizationsPage, OrganizationPage } from "../pages/organizations";
import { Layout } from "./Layout";
import { CatalogPage } from "../pages/catalog";
import { EventPage } from "../pages/event";
import { CreateEventPage } from "../pages/create-event";
import { LoginPage } from "../pages/login";
import { WorkspacePage } from "../pages/workspace";
import { NotFound } from "../shared/ui/Feedback";
import { RouteError } from "./RouteError";
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
      { path: "/users/:userId", element: <ProfilePage /> },
      { path: "/organizations", element: <OrganizationsPage /> },
      { path: "/organizations/:organizationId", element: <OrganizationPage /> },
      { path: "/organization", element: <WorkspacePage kind="organization" /> },
      { path: "/admin", element: <WorkspacePage kind="admin" /> },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
