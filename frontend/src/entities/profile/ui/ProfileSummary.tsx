import { useState } from "react";
import { MapPin, Clock3, Trophy, CalendarDays } from "lucide-react";
import type { Profile } from "../model";
import {
  sportRoleLabels,
  levelLabels,
  timeLabels,
  rankLabels,
} from "./presentation";
export function ProfileSummary({
  profile,
  sports,
  sportsLoading = false,
}: {
  profile: Profile;
  sports: { id: string; name: string }[];
  sportsLoading?: boolean;
}) {
  const [failedAvatar, setFailedAvatar] = useState<string | null>(null);
  return (
    <div className="profile-summary">
      <div className="profile-identity">
        <div className="profile-avatar" aria-hidden="true">
          {profile.avatarUrl && failedAvatar !== profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedAvatar(profile.avatarUrl)}
            />
          ) : (
            profile.name.slice(0, 1).toLocaleUpperCase("ru")
          )}
        </div>
        <div>
          <span className="eyebrow muted">Участник ДВИЖ</span>
          <h1>{profile.name}</h1>
          <p className="profile-handle">@{profile.handle}</p>
          {(profile.firstName || profile.lastName) && (
            <p>
              {[profile.firstName, profile.lastName].filter(Boolean).join(" ")}
            </p>
          )}
          <div className="profile-role-list">
            {profile.roles.length ? (
              profile.roles.map((role) => (
                <span className="profile-chip" key={role}>
                  {sportRoleLabels[role]}
                </span>
              ))
            ) : (
              <span className="muted">Спортивные роли не указаны</span>
            )}
          </div>
        </div>
      </div>
      <div className="profile-facts">
        <p>
          <MapPin size={18} />
          {profile.city || "Город не указан"}
        </p>
        <p>
          <Clock3 size={18} />
          {profile.preferredTime
            ? timeLabels[profile.preferredTime]
            : "Удобное время не указано"}
        </p>
        <p>
          <CalendarDays size={18} />В ДВИЖ с{" "}
          {new Intl.DateTimeFormat("ru-RU", {
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
        <h2 id="profile-about-heading">О себе</h2>
        <p>
          {profile.about ||
            "Пока без описания. Познакомиться можно в обсуждении встречи."}
        </p>
      </section>
      <section aria-labelledby="profile-interests-heading">
        <h2 id="profile-interests-heading">Спортивные интересы</h2>
        {sportsLoading && profile.preferences.length ? (
          <p role="status">Загружаем названия видов спорта…</p>
        ) : profile.preferences.length ? (
          <ul className="profile-preferences">
            {profile.preferences.map((item) => (
              <li key={item.sportId}>
                <strong>
                  {sports.find((sport) => sport.id === item.sportId)?.name ??
                    "Вид спорта недоступен"}
                </strong>
                <span>{levelLabels[item.level]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Любимые виды спорта пока не выбраны.</p>
        )}
      </section>
      <div className="profile-rating">
        <Trophy size={24} />
        <div>
          <strong>
            {rankLabels[profile.rank]} · {profile.points} очков
          </strong>
          <p>Ранг и очки рассчитывает сервер по подтверждённому участию.</p>
        </div>
      </div>
    </div>
  );
}
