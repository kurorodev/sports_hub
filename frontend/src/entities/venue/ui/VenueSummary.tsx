import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import type { VenueMapItem } from "../../../shared/api/types";
import {
  currentOccupancy,
  observationTime,
  occupancyPresentation,
} from "./presentation";

export function VenueSummary({
  venue,
  now,
}: {
  venue: VenueMapItem;
  now: number;
}) {
  useLocale();
  const level = currentOccupancy(venue, now);
  return (
    <>
      <h3>{venue.name}</h3>
      {venue.sportName && <p>{venue.sportName}</p>}
      <p>
        {venue.location.city}, {venue.location.address}
      </p>
      <p
        className={`occupancy-status occupancy-${occupancyPresentation[level].tone}`}
      >
        {tr(occupancyPresentation[level].label)}
      </p>
      <p>{observationTime(venue, now)}</p>
      <p className="field-hint">
        {tr("Свежих оценок: ")}
        {level === "UNKNOWN" ? 0 : venue.occupancy.reportsCount}
      </p>
    </>
  );
}
