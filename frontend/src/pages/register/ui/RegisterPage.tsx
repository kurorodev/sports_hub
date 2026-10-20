import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import {
  registerPasswordAccount,
  useSessionTransition,
} from "../../../entities/session";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { passwordSignupSchema } from "../../../shared/api/signup-schema";
import type { AuthRegistrationRequest } from "../../../shared/api/types";
import { FormField } from "../../../shared/ui/FormField";

export function RegisterPage() {
  const location = useLocation();
  const [params] = useSearchParams();
  const complete = useSessionTransition(params, location.state, "/profile");
  const form = useForm<AuthRegistrationRequest>({
    resolver: zodResolver(passwordSignupSchema),
    defaultValues: { nickname: "", displayName: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: registerPasswordAccount,
    retry: false,
    onSuccess: complete,
    onError: (error) => {
      if (!(error instanceof ApiError)) return;
      if (error.status === 409) {
        form.setError(
          "nickname",
          { message: "Никнейм уже занят. Выберите другой." },
          { shouldFocus: true },
        );
      } else if ([400, 422].includes(error.status)) {
        let focused = false;
        for (const detail of error.body?.details ?? []) {
          if (
            detail.field === "nickname" ||
            detail.field === "displayName" ||
            detail.field === "password"
          ) {
            form.setError(
              detail.field,
              { message: detail.message },
              { shouldFocus: !focused },
            );
            focused = true;
          }
        }
      }
    },
  });
  const { errors } = form.formState;
  return (
    <section className="login-page register-page">
      <div className="login-intro">
        <span className="eyebrow muted">Присоединяйся к сообществу</span>
        <h1>
          Твоя встреча
          <br />
          начинается здесь<span className="brand-dot">.</span>
        </h1>
        <p>Создай профиль, найди компанию и занимайся вместе.</p>
        <div className="notice">
          <strong>Твой никнейм — твоя отметка в чате</strong>
          <p>
            Выбери никнейм и пароль. По @никнейму тебя смогут отметить в
            обсуждении встречи.
          </p>
        </div>
      </div>
      <div className="login-panel">
        <h2>Создать аккаунт</h2>
        <form
          noValidate
          onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
        >
          <fieldset
            disabled={!form.formState.isReady || mutation.isPending}
            className="signup-fields"
          >
            <legend className="sr-only">Данные нового аккаунта</legend>
            <FormField
              id="signup-nickname"
              label="Никнейм"
              hint="@nickname: 3–40 латинских букв, цифр, _ или -."
              error={errors.nickname?.message}
            >
              <input
                id="signup-nickname"
                autoComplete="username"
                placeholder="@nickname"
                autoCapitalize="none"
                spellCheck={false}
                required
                maxLength={41}
                aria-invalid={Boolean(errors.nickname)}
                aria-describedby={`signup-nickname-hint${errors.nickname ? " signup-nickname-error" : ""}`}
                {...form.register("nickname")}
              />
            </FormField>
            <FormField
              id="signup-name"
              label="Имя в профиле"
              hint="Так тебя увидят другие участники."
              error={errors.displayName?.message}
            >
              <input
                id="signup-name"
                placeholder="Например, Алексей"
                autoComplete="name"
                required
                maxLength={100}
                aria-invalid={Boolean(errors.displayName)}
                aria-describedby={`signup-name-hint${errors.displayName ? " signup-name-error" : ""}`}
                {...form.register("displayName")}
              />
            </FormField>
            <FormField
              id="signup-password"
              label="Пароль"
              hint="От 8 до 128 символов. Пробелы по краям сохраняются."
              error={errors.password?.message}
            >
              <input
                id="signup-password"
                placeholder="Придумайте пароль"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
                aria-invalid={Boolean(errors.password)}
                aria-describedby={`signup-password-hint${errors.password ? " signup-password-error" : ""}`}
                {...form.register("password")}
              />
            </FormField>
          </fieldset>
          {mutation.isError && (
            <p className="field-error" role="alert">
              {mutation.error instanceof ApiError &&
              mutation.error.status === 404
                ? "Регистрация сейчас недоступна."
                : mutation.error instanceof ApiError &&
                    mutation.error.status === 409
                  ? "Никнейм уже занят. Выберите другой."
                  : errorMessage(mutation.error)}
            </p>
          )}
          <button
            className="button primary full-width"
            type="submit"
            disabled={!form.formState.isReady || mutation.isPending}
          >
            {mutation.isPending ? "Создаём аккаунт…" : "Создать аккаунт"}
            <ArrowUpRight size={19} />
          </button>
        </form>
        <p className="auth-switch">
          Уже есть аккаунт?{" "}
          <Link
            to={{ pathname: "/login", search: location.search }}
            state={location.state}
          >
            Войти
          </Link>
        </p>
      </div>
    </section>
  );
}
