import { useState } from "react";

const storageKey = "sport.site-onboarding.v1";
function firstVisit() {
  try {
    return localStorage.getItem(storageKey) !== "seen";
  } catch {
    return true;
  }
}

export function useSiteOnboarding() {
  const [open, setOpen] = useState(firstVisit);
  function close() {
    try {
      localStorage.setItem(storageKey, "seen");
    } catch {
      /* The guide still closes when browser storage is unavailable. */
    }
    setOpen(false);
  }
  return { open, start: () => setOpen(true), close };
}
