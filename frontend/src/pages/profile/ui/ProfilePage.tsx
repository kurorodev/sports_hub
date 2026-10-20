import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { InterfacePreferences } from "../../../features/interface-preferences/ui/InterfacePreferences";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useParams,
  useSearchParams,
  useNavigate,
  Link,
} from "react-router-dom";
import { Pencil, ArrowLeft, UserRound } from "lucide-react";
import { useState } from "react";
import {
  sessionQuery,
  logoutAccount,
  replaceSession,
} from "../../../entities/session";
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
import { ProfileRecommendations } from "../../../features/user-questionnaire";
import { ErrorState, NotFound, Skeletons } from "../../../shared/ui/Feedback";
import { isUuid } from "../../../shared/lib/identifiers";
import { errorMessage } from "../../../shared/api/client";

export function ProfilePage({ own = false }: { own?: boolean }) {
  useLocale();
  const { userId = "" } = useParams();
  const client = useQueryClient();
  const navigate = useNavigate();
  const logout = useMutation({
    mutationFn: logoutAccount,
    onSuccess: async () => {
      await replaceSession(client, null);
      navigate("/login", { replace: true });
    },
  });
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
  const isOwnAdmin = own && session.data?.systemRoles.includes("ADMIN");
  const sports = useQuery({ ...sportsQuery, enabled: !isOwnAdmin });
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
        <h1>{tr("Твой спортивный профиль")}</h1>
        <p>
          {tr("Войди, чтобы рассказать о себе и выбрать спортивные интересы.")}
        </p>
        <Link className="button primary" to="/login?next=profile">
          {tr("Войти в профиль")}
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
        message={tr(profileErrorMessage(query.error))}
        retry={() => void query.refetch()}
      />
    );
  const profile = query.data;
  return (
    <section className="profile-page">
      <Link className="back-link" to="/#activities">
        <ArrowLeft size={18} />
        {tr("Все активности")}
      </Link>
      <div className="profile-toolbar">
        <span className="eyebrow muted">
          {own ? tr("Мой профиль") : tr("Публичный профиль")}
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
                {tr("Редактировать профиль")}
                <Pencil size={18} />
              </button>
            )}
            <Link className="button secondary" to="/login">
              {tr("Сменить аккаунт")}
            </Link>
            <button
              className="button secondary"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? tr("Выходим…") : tr("Выйти")}
            </button>
            {logout.isError && (
              <p role="alert" className="field-error">
                {tr(errorMessage(logout.error))}
              </p>
            )}
          </div>
        ) : (
          session.data?.user.id === profile.id && (
            <Link className="button primary" to="/profile?edit=1">
              {tr("Редактировать свой профиль")}
            </Link>
          )
        )}
      </div>
      {notice && (
        <p className="notice success" role="status">
          {tr(notice)}
        </p>
      )}
      {query.isError && (
        <div className="notice" role="alert">
          <p>
            {tr(profileErrorMessage(query.error))}
            {tr(" Показаны последние данные; введённый текст сохранён.")}
          </p>
          <button
            className="button secondary"
            onClick={() => void query.refetch()}
          >
            {tr("Обновить профиль")}
          </button>
        </div>
      )}
      {own && <InterfacePreferences />}
      {editing ? (
        <ProfileForm
          key={profile.id}
          profile={profile}
          onSaved={() => {
            setNotice(tr("Профиль сохранён"));
            closeEditor();
          }}
          onCancel={closeEditor}
        />
      ) : (
        <>
          {!isOwnAdmin && sports.isError && (
            <ErrorState
              error={sports.error}
              retry={() => void sports.refetch()}
            />
          )}
          <ProfileSummary
            administrative={own && session.data?.systemRoles.includes("ADMIN")}
            profile={profile}
            sports={sports.data ?? []}
            sportsLoading={sports.isPending}
          />
          {own && (
            <p className="profile-public-link">
              <Link to={`/users/${profile.id}`}>
                {tr("Посмотреть публичный профиль")}
              </Link>
            </p>
          )}
          {own && !isOwnAdmin && (
            <ProfileRecommendations key={profile.id} userId={profile.id} />
          )}
        </>
      )}
    </section>
  );
}
