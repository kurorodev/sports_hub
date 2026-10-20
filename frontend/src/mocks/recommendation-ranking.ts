import type {
  EventPreview,
  Questionnaire,
  Sport,
  RecommendedEvents,
} from "../shared/api/types";
export const normalizeRecommendationText = (value: string) =>
  value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, " ");
const cityKey = (value: string) =>
  normalizeRecommendationText(value)
    .replace(/^(?:город\s+|г\.\s*|г\s+)/, "")
    .trim();

export function rankRecommendations(
  events: EventPreview[],
  sports: Sport[],
  answers: Questionnaire,
  options: {
    city: string;
    includeOtherCities: boolean;
    includeOtherSports: boolean;
    now: number;
  },
): RecommendedEvents["items"] {
  return events
    .flatMap((event) => {
      if (
        event.status !== "PUBLISHED" ||
        Date.parse(event.startsAt) <= options.now ||
        event.viewerIsOrganizer ||
        event.viewerRegistrationStatus != null ||
        (event.maxParticipants != null &&
          event.confirmedCount >= event.maxParticipants)
      )
        return [];
      if (
        !options.includeOtherCities &&
        options.city &&
        cityKey(event.location.city) !== cityKey(options.city)
      )
        return [];
      const category = sports.find((sport) => sport.id === event.sport.id);
      if (!category) return [];
      const effectiveSport =
        category.isCustom && event.customSportName
          ? (sports.find(
              (sport) =>
                normalizeRecommendationText(sport.name) ===
                normalizeRecommendationText(event.customSportName!),
            ) ?? category)
          : category;
      const preference =
        answers.sportsPreferences.find(
          (pref) => pref.sportId === effectiveSport.id,
        ) ??
        answers.sportsPreferences.find((pref) => pref.sportId === category.id);
      if (
        !options.includeOtherSports &&
        answers.sportsPreferences.length &&
        !preference
      )
        return [];
      if (
        answers.age != null &&
        ((event.recommendedMinAge != null &&
          answers.age < event.recommendedMinAge) ||
          (event.recommendedMaxAge != null &&
            answers.age > event.recommendedMaxAge))
      )
        return [];
      let score = 5;
      const matchReasons: RecommendedEvents["items"][number]["matchReasons"] = [
        "AVAILABLE_SPOTS",
      ];
      if (preference) {
        score += 60;
        matchReasons.push("FAVORITE_SPORT");
      }
      if (
        event.skillLevel === "ANY" ||
        preference?.level === event.skillLevel
      ) {
        score += 15;
        matchReasons.push("SUITABLE_LEVEL");
      }
      const hour = Number(
        new Intl.DateTimeFormat("en", {
          timeZone: answers.timeZone,
          hour: "numeric",
          hourCycle: "h23",
        }).format(new Date(event.startsAt)),
      );
      const period =
        hour < 6
          ? "NIGHT"
          : hour < 12
            ? "MORNING"
            : hour < 18
              ? "DAY"
              : "EVENING";
      if (answers.preferredTime === period) {
        score += 10;
        matchReasons.push("PREFERRED_TIME");
      }
      if (
        answers.age != null &&
        (event.recommendedMinAge != null || event.recommendedMaxAge != null)
      ) {
        score += 10;
        matchReasons.push("SUITABLE_AGE");
      }
      return [{ event, score, matchReasons }];
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
        a.event.id.localeCompare(b.event.id),
    );
}
