import { Languages, Moon, Sun } from "lucide-react";
import { usePreferences } from "../../../shared/i18n/use-preferences";
import { setPreferences } from "../../../shared/i18n/preferences";
import { tr } from "../../../shared/i18n/translate";
export function InterfacePreferences() {
  const { locale, theme } = usePreferences();
  return (
    <section
      className="interface-preferences"
      aria-labelledby="interface-preferences-title"
    >
      <div>
        <h2 id="interface-preferences-title">{tr("Настройки интерфейса")}</h2>
        <p className="muted">
          {tr(
            "Выбор сохраняется в этом браузере и применяется ко всему сайту.",
          )}
        </p>
      </div>
      <div className="interface-preference-row">
        <div className="interface-preference-label">
          <Languages size={22} aria-hidden="true" />
          <span>{tr("Язык интерфейса")}</span>
        </div>
        <div
          className="interface-segments"
          role="group"
          aria-label={tr("Язык интерфейса")}
        >
          <button
            type="button"
            lang="ru"
            aria-pressed={locale === "ru"}
            onClick={() => setPreferences({ locale: "ru" })}
          >
            RU
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={locale === "en"}
            onClick={() => setPreferences({ locale: "en" })}
          >
            EN
          </button>
        </div>
      </div>
      <div className="interface-preference-row">
        <div className="interface-preference-label">
          <Sun size={22} aria-hidden="true" />
          <span>{tr("Тема оформления")}</span>
        </div>
        <div
          className="interface-segments"
          role="group"
          aria-label={tr("Тема оформления")}
        >
          <button
            type="button"
            aria-pressed={theme === "light"}
            onClick={() => setPreferences({ theme: "light" })}
          >
            <Sun size={16} aria-hidden="true" />
            {tr("Светлая")}
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            onClick={() => setPreferences({ theme: "dark" })}
          >
            <Moon size={16} aria-hidden="true" />
            {tr("Тёмная")}
          </button>
        </div>
      </div>
    </section>
  );
}
