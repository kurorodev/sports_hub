// Functional scenarios start as returning visitors; the onboarding suite tests first visits.
export const familiarVisitorState = {
  cookies: [],
  origins: ["http://127.0.0.1:5174", "http://127.0.0.1:5175"].map((origin) => ({
    origin,
    localStorage: [{ name: "sport.site-onboarding.v1", value: "seen" }],
  })),
};
