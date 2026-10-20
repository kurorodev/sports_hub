import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  Headset,
  MapPin,
  MessageCircle,
  Search,
  ShieldCheck,
  SunMoon,
  UserRound,
} from "lucide-react";
import { Dialog } from "../../../shared/ui/Dialog";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";

type Preview =
  | "catalog"
  | "participation"
  | "map"
  | "plans"
  | "profile"
  | "moderation"
  | "support";
type Step = {
  title: string;
  description: string;
  location: string;
  tip: string;
  preview: Preview;
};
const catalog: Step = {
  title: "Найдите интересную встречу",
  description:
    "В «Активностях» ищите мероприятия по названию и выбирайте спорт, дату или город. Откройте карточку, чтобы узнать место, время и условия.",
  location: "Шапка сайта → Активности",
  tip: "Смотреть встречи можно без регистрации.",
  preview: "catalog",
};
const map: Step = {
  title: "Посмотрите, что рядом",
  description:
    "На карте показаны мероприятия и спортивные площадки. Нажмите на метку, чтобы открыть подробности. Цвет площадки подсказывает её текущую загруженность.",
  location: "Шапка сайта → Карта",
  tip: "Геолокация включается только с вашего разрешения.",
  preview: "map",
};
const profile: Step = {
  title: "Настройте сайт под себя",
  description:
    "Нажмите на аватар в шапке: в профиле можно изменить фото, выбрать язык и тему. Если нужна помощь, откройте поддержку по значку наушников.",
  location: "Шапка сайта → Аватар или наушники",
  tip: "Повторить обучение можно по ссылке «Как пользоваться сайтом» внизу страницы.",
  preview: "profile",
};
const userSteps: Step[] = [
  catalog,
  {
    title: "Присоединяйтесь и общайтесь",
    description:
      "Войдите в аккаунт и нажмите «Присоединиться» на странице встречи. Если нужна проверка организатора, отправьте заявку. В обсуждении можно задать вопрос.",
    location: "Карточка мероприятия → Страница встречи",
    tip: "Заявка ещё не означает участие: дождитесь одобрения. Изменения появятся в колокольчике.",
    preview: "participation",
  },
  map,
  {
    title: "Все ваши планы — в одном месте",
    description:
      "В «Моих мероприятиях» есть предстоящие встречи и история. До начала можно отменить участие с подтверждением. Собственные встречи находятся во вкладке «Я организатор».",
    location: "Шапка сайта → Мои мероприятия",
    tip: "Чтобы собрать свою встречу, выберите «Создать» в шапке. Для этих действий нужен вход в аккаунт.",
    preview: "plans",
  },
  profile,
];
const adminSteps: Step[] = [
  catalog,
  map,
  {
    title: "Управляйте модерацией",
    description:
      "В разделе «Модерация» рассматривайте организации, мероприятия и комментарии. Используйте фильтры, чтобы найти нужную запись. Здесь же доступны спортивные категории и истории.",
    location: "Шапка сайта → Модерация",
    tip: "Администратор просматривает сайт и управляет им; запись на встречи и их создание ему недоступны.",
    preview: "moderation",
  },
  {
    title: "Помогайте пользователям",
    description:
      "По значку наушников открывается очередь поддержки. Выберите обращение, ответьте пользователю и обновите его статус. Ответы и изменения приходят в уведомления.",
    location: "Шапка сайта → Наушники",
    tip: "Для повторного знакомства используйте «Как пользоваться сайтом» внизу страницы.",
    preview: "support",
  },
];

function GuidePreview({ kind }: { kind: Preview }) {
  return (
    <div
      className={`site-guide-preview site-guide-preview-${kind}`}
      aria-hidden="true"
    >
      <span className="site-guide-example">{tr("Пример интерфейса")}</span>
      {kind === "catalog" ? (
        <>
          <div className="site-guide-search">
            <Search size={18} />
            <span>{tr("Поиск мероприятий")}</span>
          </div>
          <div className="site-guide-chips">
            <span>{tr("Вид спорта")}</span>
            <span>{tr("Дата")}</span>
            <span>{tr("Город")}</span>
          </div>
          <div className="site-guide-mini-card">
            <CalendarDays size={28} />
            <div>
              <strong>{tr("Ваша следующая встреча")}</strong>
              <span>{tr("Место, время и условия")}</span>
            </div>
            <ArrowRight size={18} />
          </div>
        </>
      ) : kind === "participation" ? (
        <>
          <div className="site-guide-join">
            <span>{tr("Присоединиться")}</span>
            <ArrowRight size={20} />
            <strong>
              <CheckCircle2 size={18} />
              {tr("Вы участвуете")}
            </strong>
          </div>
          <div className="site-guide-mini-card">
            <MessageCircle size={26} />
            <strong>{tr("Обсуждение встречи")}</strong>
          </div>
        </>
      ) : kind === "map" ? (
        <div className="site-guide-map">
          <MapPin size={38} fill="currentColor" />
          <span>
            <MapPin size={22} />
            {tr("Площадка рядом")}
          </span>
          <i />
          <i />
          <i />
        </div>
      ) : kind === "plans" ? (
        <>
          <div className="site-guide-chips">
            <span>{tr("Предстоящие")}</span>
            <span>{tr("История")}</span>
          </div>
          <div className="site-guide-mini-card">
            <CalendarDays size={28} />
            <div>
              <strong>{tr("Мои мероприятия")}</strong>
              <span>{tr("Участия и заявки")}</span>
            </div>
            <CheckCircle2 size={22} />
          </div>
        </>
      ) : kind === "profile" ? (
        <>
          <div className="site-guide-mini-card">
            <UserRound size={30} />
            <div>
              <strong>{tr("Ваш профиль")}</strong>
              <span>{tr("Фото и настройки")}</span>
            </div>
            <SunMoon size={24} />
          </div>
          <div className="site-guide-chips">
            <span>RU / EN</span>
            <span>
              <Bell size={16} />
              {tr("Уведомления")}
            </span>
            <span>
              <Headset size={16} />
              {tr("Помощь")}
            </span>
          </div>
        </>
      ) : kind === "moderation" ? (
        <div className="site-guide-mini-card">
          <ShieldCheck size={32} />
          <div>
            <strong>{tr("Модерация")}</strong>
            <span>{tr("Организации · Мероприятия · Комментарии")}</span>
          </div>
        </div>
      ) : (
        <div className="site-guide-mini-card">
          <Headset size={32} />
          <div>
            <strong>{tr("Очередь поддержки")}</strong>
            <span>{tr("Обращение → Ответ → Решение")}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function SiteOnboarding({
  admin,
  onClose,
}: {
  admin: boolean;
  onClose: () => void;
}) {
  useLocale();
  const [index, setIndex] = useState(0);
  const steps = admin ? adminSteps : userSteps;
  const step = steps[index];
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [index]);
  return (
    <Dialog labelledBy={id} className="site-guide-dialog" onClose={onClose}>
      <div className="site-guide-header">
        <span>
          <BookOpen size={18} />
          {tr("Коротко о сайте")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={tr("Пропустить обучение")}
        >
          {tr("Пропустить")}
        </button>
      </div>
      <div className="site-guide-progress">
        <span>{tr("Шаг {0} из {1}", [index + 1, steps.length])}</span>
        <ol aria-label={tr("Прогресс обучения")}>
          {steps.map((item, n) => (
            <li
              key={item.preview}
              aria-current={n === index ? "step" : undefined}
              className={n <= index ? "is-reached" : ""}
            >
              <span className="sr-only">{tr(item.title)}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="site-guide-content">
        <GuidePreview kind={step.preview} />
        <div className="site-guide-copy" aria-live="polite" aria-atomic="true">
          <h2 id={id} ref={heading} tabIndex={-1}>
            {tr(step.title)}
          </h2>
          <p>{tr(step.description)}</p>
          <div className="site-guide-location">
            <MapPin size={16} aria-hidden="true" />
            <span>{tr(step.location)}</span>
          </div>
          <p className="site-guide-tip">{tr(step.tip)}</p>
        </div>
      </div>
      <div className="site-guide-actions">
        <button
          type="button"
          className="button secondary"
          onClick={() => setIndex((current) => current - 1)}
          disabled={index === 0}
        >
          <ArrowLeft size={18} />
          {tr("Назад")}
        </button>
        <button
          type="button"
          className="button primary"
          onClick={() => {
            if (index === steps.length - 1) onClose();
            else setIndex((current) => current + 1);
          }}
        >
          {index === steps.length - 1 ? (
            <>
              {tr("Всё понятно")}
              <Check size={18} />
            </>
          ) : (
            <>
              {tr("Далее")}
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </Dialog>
  );
}
