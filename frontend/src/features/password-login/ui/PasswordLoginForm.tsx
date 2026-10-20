import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { loginWithPassword } from "../../../entities/session";
import type { AuthLoginRequest, Session } from "../../../shared/api/types";
import { ApiError, errorMessage } from "../../../shared/api/client";
import { FormField } from "../../../shared/ui/FormField";

export function PasswordLoginForm({
  onSuccess,
}: {
  onSuccess: (session: Session) => Promise<void>;
}) {
  useLocale();
  const form = useForm<AuthLoginRequest>({
    defaultValues: { nickname: "", password: "" },
  });
  const mutation = useMutation({
    mutationFn: loginWithPassword,
    onSuccess,
    retry: false,
  });
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
    >
      <fieldset
        className="signup-fields"
        disabled={!form.formState.isReady || mutation.isPending}
      >
        <legend className="sr-only">{tr("Вход по никнейму и паролю")}</legend>
        <FormField
          id="login-nickname"
          label={tr("Никнейм")}
          error={form.formState.errors.nickname?.message}
        >
          <input
            id="login-nickname"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="@nickname"
            maxLength={41}
            aria-invalid={Boolean(form.formState.errors.nickname)}
            {...form.register("nickname", {
              required: "Укажите никнейм",
              validate: (v) => v.trim().length > 0 || "Укажите никнейм",
            })}
          />
        </FormField>
        <FormField
          id="login-password"
          label={tr("Пароль")}
          error={form.formState.errors.password?.message}
        >
          <input
            id="login-password"
            placeholder={tr("Введите пароль")}
            type="password"
            autoComplete="current-password"
            maxLength={128}
            aria-invalid={Boolean(form.formState.errors.password)}
            {...form.register("password", { required: "Укажите пароль" })}
          />
        </FormField>
      </fieldset>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {mutation.error instanceof ApiError && mutation.error.status === 401
            ? tr("Неверный никнейм или пароль")
            : errorMessage(mutation.error)}
        </p>
      )}
      <button
        className="button primary full-width"
        disabled={!form.formState.isReady || mutation.isPending}
        type="submit"
      >
        {mutation.isPending ? tr("Входим…") : tr("Войти")}
      </button>
    </form>
  );
}
