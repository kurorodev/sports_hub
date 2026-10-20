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
      /* Закрываем знакомство с сайтом и при недоступном хранилище. */
    }
    setOpen(false);
  }
  return { open, start: () => setOpen(true), close };
}
