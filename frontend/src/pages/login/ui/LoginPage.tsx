import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowUpRight, Check, UserRound } from "lucide-react";
import {
  apiConfig,
  errorMessage,
  setCsrfToken,
} from "../../../shared/api/client";
import { ErrorState } from "../../../shared/ui/Feedback";
import {
  demoAccountsQuery,
  sessionQuery,
  switchAccount,
} from "../../../entities/session";

const schema = z.object({
  accountId: z.string().min(1, "Выберите демо-аккаунт"),
});
type LoginValues = z.infer<typeof schema>;

export function LoginPage() {
  const accounts = useQuery(demoAccountsQuery);
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { accountId: "" },
  });
  const mutation = useMutation({
    mutationFn: switchAccount,
    onSuccess: async (session) => {
      await client.cancelQueries();
      client.clear();
      setCsrfToken(session.csrfToken);
      client.setQueryData(sessionQuery.queryKey, session);
      const eventId = params.get("eventId") ?? "";
      const destination =
        params.get("next") === "map"
          ? "/map"
          : params.get("next") === "organization"
            ? "/organization"
            : params.get("next") === "create-event"
              ? "/events/new"
              : ["join-event", "event-discussion"].includes(
                    params.get("next") ?? "",
                  ) && /^[\w-]{1,100}$/.test(eventId)
                ? `/events/${encodeURIComponent(eventId)}${params.get("next") === "event-discussion" ? "#event-discussion" : ""}`
                : "/";
      navigate(destination, {
        replace: true,
      });
    },
  });
  const selected = useWatch({ control: form.control, name: "accountId" });
  return (
    <section className="login-page">
      <div className="login-intro">
        <span className="eyebrow muted">Сначала познакомимся</span>
        <h1>
          Твоя компания
          <br />
          уже рядом<span className="brand-dot">.</span>
        </h1>
        <p>
          Выбери аккаунт, чтобы проверить пользовательские роли и восстановление
          сессии.
        </p>
        <div className="notice">
          <strong>
            {apiConfig.mode === "mock"
              ? "Демо на локальных моках"
              : "Режим реального API"}
          </strong>
          <p>
            {apiConfig.mode === "mock"
              ? "Это тестовые аккаунты. Данные не отправляются в Java backend. Переключение очищает кэш предыдущего пользователя."
              : "Вход доступен, если backend предоставляет демо-сессии. Используется HttpOnly-cookie."}
          </p>
        </div>
      </div>
      <div className="login-panel">
        <h2>Демо-вход</h2>
        {accounts.isPending ? (
          <p role="status">Загружаем аккаунты…</p>
        ) : accounts.isError ? (
          <ErrorState
            error={accounts.error}
            retry={() => void accounts.refetch()}
          />
        ) : accounts.data.length === 0 ? (
          <p>Демо-аккаунты пока не настроены на сервере.</p>
        ) : (
          <form
            onSubmit={form.handleSubmit((values) =>
              mutation.mutate(values.accountId),
            )}
          >
            <fieldset disabled={mutation.isPending}>
              <legend className="sr-only">Выберите демо-аккаунт</legend>
              {accounts.data.map((account) => (
                <label
                  className={`account-option ${selected === account.id ? "selected" : ""}`}
                  key={account.id}
                >
                  <input
                    type="radio"
                    value={account.id}
                    {...form.register("accountId")}
                  />
                  <span className="account-icon">
                    <UserRound size={21} />
                  </span>
                  <span>
                    <strong>{account.label}</strong>
                    <small>{account.systemRoles.join(" · ")}</small>
                  </span>
                  {selected === account.id && (
                    <Check className="account-check" size={20} />
                  )}
                </label>
              ))}
            </fieldset>
            {form.formState.errors.accountId && (
              <p className="field-error" role="alert">
                {form.formState.errors.accountId.message}
              </p>
            )}
            {mutation.isError && (
              <p className="field-error" role="alert">
                {errorMessage(mutation.error)}
              </p>
            )}
            <button
              className="button primary full-width"
              disabled={mutation.isPending}
              type="submit"
            >
              {mutation.isPending ? "Входим…" : "Войти в аккаунт"}
              <ArrowUpRight size={19} />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
