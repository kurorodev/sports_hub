import { localeTag } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Avatar } from "../../../shared/ui/Avatar";
import { MapPin, Clock3, CalendarDays } from "lucide-react";
import type { Profile } from "../model";
import { sportRoleLabels, levelLabels, timeLabels } from "./presentation";
export function ProfileSummary({
  profile,
  sports,
  sportsLoading = false,
  administrative = false,
}: {
  administrative?: boolean;
  profile: Profile;
  sports: { id: string; name: string }[];
  sportsLoading?: boolean;
}) {
  useLocale();
  return (
    <div className="profile-summary">
      <div className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">
          <Avatar
            id={profile.id}
            name={profile.name}
            url={profile.avatarUrl}
            size="100%"
          />
        </div>
        <div>
          <span className="eyebrow muted">
            {tr(administrative ? "Администратор" : "Участник сообщества")}
          </span>
          <h1>{profile.name}</h1>
          <p className="profile-handle">@{profile.handle}</p>
          {(profile.firstName || profile.lastName) && (
            <p>
              {[profile.firstName, profile.lastName].filter(Boolean).join(" ")}
            </p>
          )}
          {!administrative && (
            <>
              <div className="profile-role-list">
                {profile.roles.length ? (
                  profile.roles.map((role) => (
                    <span className="profile-chip" key={role}>
                      {tr(sportRoleLabels[role])}
                    </span>
                  ))
                ) : (
                  <span className="muted">
                    {tr("Спортивные роли не указаны")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="profile-facts">
        <p>
          <MapPin size={18} />
          {profile.city || tr("Город не указан")}
        </p>
        {!administrative && (
          <>
            <p>
              <Clock3 size={18} />
              {profile.preferredTime
                ? tr(timeLabels[profile.preferredTime])
                : tr("Удобное время не указано")}
            </p>
          </>
        )}
        <p>
          <CalendarDays size={18} />
          {tr("На платформе с")}{" "}
          {new Intl.DateTimeFormat(localeTag(), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          }).format(new Date(profile.memberSince))}
        </p>
      </div>
      <section
        className="profile-about"
        aria-labelledby="profile-about-heading"
      >
        <h2 id="profile-about-heading">{tr("О себе")}</h2>
        <p>
          {profile.about ||
            tr(
              administrative
                ? "Информация пока не указана."
                : "Пока без описания. Познакомиться можно в обсуждении встречи.",
            )}
        </p>
      </section>
      {!administrative && (
        <>
          <section aria-labelledby="profile-interests-heading">
            <h2 id="profile-interests-heading">{tr("Спортивные интересы")}</h2>
            {sportsLoading && profile.preferences.length ? (
              <p role="status">{tr("Загружаем названия видов спорта…")}</p>
            ) : profile.preferences.length ? (
              <ul className="profile-preferences">
                {profile.preferences.map((item) => (
                  <li key={item.sportId}>
                    <strong>
                      {sports.find((sport) => sport.id === item.sportId)
                        ?.name ?? tr("Вид спорта недоступен")}
                    </strong>
                    <span>{tr(levelLabels[item.level])}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">
                {tr("Любимые виды спорта пока не выбраны.")}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
