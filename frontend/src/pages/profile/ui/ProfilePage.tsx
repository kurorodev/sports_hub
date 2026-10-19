import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Pencil, ArrowLeft, UserRound } from "lucide-react";
import { useState } from "react";
import { sessionQuery } from "../../../entities/session";
import { sportsQuery } from "../../../entities/event";
import {
  ownProfileQuery,
  publicProfileQuery,
  useProfileRepository,
  profileErrorMessage,
  ProfileSummary,
} from "../../../entities/profile";
import { ProfileFailure } from "../../../entities/profile/model";
import { ProfileForm } from "../../../features/edit-profile";
import { ErrorState, NotFound, Skeletons } from "../../../shared/ui/Feedback";
import { isUuid } from "../../../shared/lib/identifiers";
export function ProfilePage({ own = false }: { own?: boolean }) {
  const { userId = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const [notice, setNotice] = useState("");
  const session = useQuery(sessionQuery);
  const repo = useProfileRepository();
  const id = own ? (session.data?.user.id ?? "") : userId;
  const ownQuery = useQuery({
    ...ownProfileQuery(repo, id),
    enabled: own && Boolean(session.data) && !session.isError,
  });
  const publicQuery = useQuery({
    ...publicProfileQuery(repo, id),
    enabled: !own && isUuid(id),
  });
  const query = own ? ownQuery : publicQuery;
  const sports = useQuery(sportsQuery);
  const editing = own && params.get("edit") === "1";
  function closeEditor() {
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("edit");
      return next;
    });
  }
  if (!own && !isUuid(id)) return <NotFound />;
  if (own && session.isPending) return <Skeletons />;
  if (own && session.isError)
    return (
      <ErrorState error={session.error} retry={() => void session.refetch()} />
    );
  if (own && !session.data)
    return (
      <section className="feedback page-state">
        <UserRound size={36} />
        <h1>Твой профиль в ДВИЖ</h1>
        <p>Войди, чтобы рассказать о себе и выбрать спортивные интересы.</p>
        <Link className="button primary" to="/login?next=profile">
          Войти в профиль
        </Link>
      </section>
    );
  if (query.isPending) return <Skeletons />;
  const accessLost =
    query.error instanceof ProfileFailure &&
    ["unauthenticated", "forbidden", "not-found"].includes(query.error.code);
  if (!query.data || accessLost)
    return query.error instanceof ProfileFailure &&
      query.error.code === "not-found" ? (
      <NotFound />
    ) : (
      <ErrorState
        error={query.error}
        message={profileErrorMessage(query.error)}
        retry={() => void query.refetch()}
      />
    );
  const profile = query.data;
  return (
    <section className="profile-page">
      <Link className="back-link" to="/#activities">
        <ArrowLeft size={18} />
        Все активности
      </Link>
      <div className="profile-toolbar">
        <span className="eyebrow muted">
          {own ? "Мой профиль" : "Публичный профиль"}
        </span>
        {own ? (
          <div>
            {!editing && (
              <button
                className="button primary"
                onClick={() => {
                  setNotice("");
                  setParams({ edit: "1" });
                }}
              >
                Редактировать профиль
                <Pencil size={18} />
              </button>
            )}
            <Link className="button secondary" to="/login">
              Сменить демо-аккаунт
            </Link>
          </div>
        ) : (
          session.data?.user.id === profile.id && (
            <Link className="button primary" to="/profile?edit=1">
              Редактировать свой профиль
            </Link>
          )
        )}
      </div>
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {query.isError && (
        <div className="notice" role="alert">
          <p>
            {profileErrorMessage(query.error)} Показаны последние данные;
            введённый текст сохранён.
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            Обновить профиль
          </button>
        </div>
      )}
      {editing ? (
        <ProfileForm
          key={profile.id}
          profile={profile}
          onSaved={() => {
            setNotice("Профиль сохранён");
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      ) : (
        <>
          {sports.isError && (
            <ErrorState
              error={sports.error}
              retry={() => void sports.refetch()}
            />
          )}
          <ProfileSummary
            profile={profile}
            sports={sports.data ?? []}
            sportsLoading={sports.isPending}
          />
          {own && (
            <p className="profile-public-link">
              <Link to={`/users/${profile.id}`}>
                Посмотреть публичный профиль
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
