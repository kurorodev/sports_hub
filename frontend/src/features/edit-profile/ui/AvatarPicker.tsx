import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { Check } from "lucide-react";
import { Avatar } from "../../../shared/ui/Avatar";
import {
  avatarCharacter,
  avatarCharacters,
  avatarPath,
  type AvatarTone,
} from "../../../shared/model/avatars";

export function AvatarPicker({
  viewerId,
  value,
  tone,
  onChange,
}: {
  viewerId: string;
  value: string;
  tone: AvatarTone;
  onChange: (url: string) => void;
}) {
  useLocale();
  const selected = avatarCharacter(value);
  return (
    <div className="avatar-picker">
      <div className="avatar-picker-preview">
        <Avatar id={viewerId} name="Аватар" url={value} tone={tone} size={88} />
        <div>
          <h3>{tr("Твой персонаж")}</h3>
          <p>
            {tr(
              "Выбери один из 10 образов. Персонаж останется с тобой, а форма меняется по роли: синяя — участник, красная — организатор, жёлтая — администратор.",
            )}
          </p>
        </div>
      </div>
      <div
        className="avatar-picker-grid"
        role="group"
        aria-label={tr("Выбор аватара")}
      >
        {avatarCharacters.map((character) => (
          <button
            type="button"
            key={character.id}
            className="avatar-choice"
            aria-label={tr(character.label)}
            aria-pressed={selected === character.id}
            onClick={() => onChange(avatarPath(character.id, tone))}
          >
            <img
              src={avatarPath(character.id, tone)}
              alt=""
              width="88"
              height="88"
              loading="lazy"
            />
            {selected === character.id && (
              <span className="avatar-choice-check">
                <Check size={14} />
              </span>
            )}
          </button>
        ))}
      </div>
      <button
        className="text-button"
        type="button"
        onClick={() => onChange("")}
      >
        {tr("Сбросить аватар")}
      </button>
    </div>
  );
}
