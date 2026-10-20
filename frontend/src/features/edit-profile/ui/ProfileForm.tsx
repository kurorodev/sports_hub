import { Textarea } from "../../../shared/ui/Textarea";
import { Select } from "../../../shared/ui/Select";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { sportsQuery } from "../../../entities/event";
import {
  profileErrorMessage,
  sportRoleLabels,
  levelLabels,
  timeLabels,
} from "../../../entities/profile";
import {
  profileDraft,
  safeAvatarUrl,
  sportRoles,
  experienceLevels,
  preferredTimes,
  type Profile,
} from "../../../entities/profile/model";
import { handleSchema } from "../../../shared/api/signup-schema";
import { FormField } from "../../../shared/ui/FormField";
import { ErrorState } from "../../../shared/ui/Feedback";
import { useUpdateProfile } from "./use-update-profile";
import { AvatarPicker } from "./AvatarPicker";
import { avatarCharacter } from "../../../shared/model/avatars";
import { sessionQuery } from "../../../entities/session";
const schema = z.object({
  handle: handleSchema,
  name: z
    .string()
    .trim()
    .min(1, "Укажите имя")
    .max(100, "Имя — до 100 символов"),
  firstName: z.string().trim().max(80, "До 80 символов"),
  lastName: z.string().trim().max(80, "До 80 символов"),
  about: z.string().trim().max(1000, "Описание — до 1000 символов"),
  city: z.string().trim().max(100, "Город — до 100 символов"),
  avatarUrl: z
    .string()
    .trim()
    .refine(
      (value) => !value || safeAvatarUrl(value),
      "Выберите аватар или укажите ссылку http/https без логина и пароля, до 2048 символов",
    ),
  roles: z.array(z.enum(sportRoles)),
  preferences: z.array(
    z.object({ sportId: z.string().uuid(), level: z.enum(experienceLevels) }),
  ),
  preferredTime: z.union([z.enum(preferredTimes), z.literal("")]),
});
type Values = z.infer<typeof schema>;
export function ProfileForm({
  profile,
  onSaved,
  onCancel,
}: {
  profile: Profile;
  onSaved: (profile: Profile) => void;
  onCancel: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: profileDraft(profile),
  });
  const preferences = useFieldArray({
    control: form.control,
    name: "preferences",
  });
  const sports = useQuery(sportsQuery);
  const session = useQuery(sessionQuery);
  const avatarUrl = useWatch({ control: form.control, name: "avatarUrl" });
  const avatarTone = session.data?.systemRoles.includes("ADMIN")
    ? "admin"
    : session.data?.systemRoles.includes("ORGANIZATION")
      ? "organizer"
      : "user";
  const mutation = useUpdateProfile(onSaved);
  const errors = form.formState.errors;
  const fields = [
    ["name", "Имя в профиле", 100, "Например, Алексей"],
    ["handle", "Никнейм", 41, "Например, @alex_sport"],
    ["firstName", "Имя (необязательно)", 80, "Например, Алексей"],
    ["lastName", "Фамилия (необязательно)", 80, "Например, Иванов"],
    ["city", "Город", 100, "Например, Самара"],
  ] as const;
  return (
    <form
      className="profile-form"
      noValidate
      onSubmit={form.handleSubmit((draft) =>
        mutation.mutate({ viewerId: profile.id, draft }),
      )}
    >
      <h1>Редактировать профиль</h1>
      <p className="muted">
        Эти данные видны в публичном профиле. Указывайте то, чем готовы
        поделиться.
      </p>
      <fieldset disabled={mutation.isPending}>
        <legend>Аватар</legend>
        <AvatarPicker
          viewerId={profile.id}
          value={avatarUrl}
          tone={avatarTone}
          onChange={(value) =>
            form.setValue("avatarUrl", value, {
              shouldDirty: true,
              shouldValidate: true,
            })
          }
        />
        <details className="avatar-custom">
          <summary>Использовать своё изображение по ссылке</summary>
          <FormField
            id="profile-avatarUrl"
            label="Ссылка на аватар"
            error={errors.avatarUrl?.message}
            hint="Ссылка http или https. Недоступное изображение заменим первой буквой имени."
          >
            <input
              id="profile-avatarUrl"
              value={avatarCharacter(avatarUrl) ? "" : avatarUrl}
              onChange={(event) =>
                form.setValue("avatarUrl", event.target.value, {
                  shouldDirty: true,
                  shouldValidate: true,
                })
              }
              maxLength={2048}
              placeholder="https://…"
              aria-invalid={Boolean(errors.avatarUrl)}
            />
          </FormField>
        </details>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>Знакомство</legend>
        <div className="profile-form-grid">
          {fields.map(([field, label, max, placeholder]) => (
            <FormField
              key={field}
              id={`profile-${field}`}
              label={label}
              error={errors[field]?.message}
              hint={
                field === "handle"
                  ? "Можно с @ или без. 3–40 латинских букв, цифр, _ или -."
                  : undefined
              }
            >
              <input
                id={`profile-${field}`}
                placeholder={placeholder}
                {...form.register(field)}
                maxLength={max}
                autoComplete={
                  field === "firstName"
                    ? "given-name"
                    : field === "lastName"
                      ? "family-name"
                      : field === "city"
                        ? "address-level2"
                        : "off"
                }
                aria-invalid={Boolean(errors[field])}
                aria-describedby={
                  errors[field] ? `profile-${field}-error` : undefined
                }
              />
            </FormField>
          ))}
        </div>
        <FormField
          id="profile-about"
          label="О себе"
          hint="До 1000 символов. Например, какой спорт любите и какую компанию ищете."
          error={errors.about?.message}
        >
          <Textarea
            id="profile-about"
            placeholder="Расскажите, каким спортом занимаетесь и с кем хотите тренироваться"
            {...form.register("about")}
            rows={5}
            maxLength={1000}
            aria-invalid={Boolean(errors.about)}
            aria-describedby={
              errors.about ? "profile-about-error" : "profile-about-hint"
            }
          />
        </FormField>
        <FormField id="profile-time" label="Когда удобно заниматься">
          <Select id="profile-time" {...form.register("preferredTime")}>
            <option value="">Не указано</option>
            {preferredTimes.map((value) => (
              <option value={value} key={value}>
                {timeLabels[value]}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>Спортивные роли</legend>
        <p className="field-hint">
          Роли описывают ваш опыт. Они не дают административных прав или доступа
          к чужим соревнованиям.
        </p>
        <div className="profile-role-options">
          {sportRoles.map((role) => (
            <label key={role}>
              <input type="checkbox" value={role} {...form.register("roles")} />
              {sportRoleLabels[role]}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset disabled={mutation.isPending}>
        <legend>Любимые виды спорта</legend>
        <p className="field-hint">
          Выберите интересы и свой уровень. Их можно изменить или убрать.
        </p>
        {sports.isPending ? (
          <p role="status">Загружаем виды спорта…</p>
        ) : sports.isError ? (
          <ErrorState
            error={sports.error}
            retry={() => void sports.refetch()}
          />
        ) : (
          <div className="profile-sport-options">
            {sports.data.map((sport) => {
              const index = preferences.fields.findIndex(
                (item) => item.sportId === sport.id,
              );
              return (
                <label key={sport.id}>
                  <input
                    type="checkbox"
                    checked={index >= 0}
                    onChange={(event) =>
                      event.target.checked
                        ? preferences.append({
                            sportId: sport.id,
                            level: "BEGINNER",
                          })
                        : preferences.remove(index)
                    }
                  />
                  {sport.name}
                </label>
              );
            })}
          </div>
        )}
        {preferences.fields.map((item, index) => (
          <div className="profile-preference-row" key={item.id}>
            <FormField
              id={`profile-level-${item.sportId}`}
              label={`Уровень: ${sports.data?.find((sport) => sport.id === item.sportId)?.name ?? "Вид спорта недоступен"}`}
              error={errors.preferences?.[index]?.level?.message}
            >
              <Select
                id={`profile-level-${item.sportId}`}
                {...form.register(`preferences.${index}.level`)}
              >
                {experienceLevels.map((level) => (
                  <option key={level} value={level}>
                    {levelLabels[level]}
                  </option>
                ))}
              </Select>
            </FormField>
            <button
              className="button secondary"
              type="button"
              onClick={() => preferences.remove(index)}
            >
              Убрать интерес
            </button>
          </div>
        ))}
      </fieldset>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {profileErrorMessage(mutation.error)} Введённые данные сохранены,
          можно повторить отправку.
        </p>
      )}
      <div className="profile-form-actions">
        <button
          className="button primary"
          type="submit"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Сохраняем профиль…" : "Сохранить профиль"}
          <Save size={18} />
        </button>
        <button
          className="button secondary"
          type="button"
          disabled={mutation.isPending}
          onClick={onCancel}
        >
          Отменить изменения
        </button>
      </div>
    </form>
  );
}
