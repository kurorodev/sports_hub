import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { eventsQuery } from "./api";
import { EventCard } from "./EventCard";
import { sportOptions } from "./presentation";
import { EmptyState, ErrorState, Skeletons } from "../../shared/ui/Feedback";

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const query = useQuery(eventsQuery(params));
  const setFilter = (key: string, value: string) => {
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  };
  const activeCount = [
    "city",
    "from",
    "to",
    "skillLevel",
    "joinMode",
    "hasSpots",
    "includePast",
  ].filter((key) => params.has(key)).length;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" />
            Люди. Спорт. Твой ритм.
          </span>
          <h1>
            Вместе —<br />
            больше <span>движа.</span>
          </h1>
          <p>
            Найди компанию для спорта.
            <br />
            От первой пробежки до игры на равных.
          </p>
          <a className="button primary" href="#activities">
            Выбрать активность
            <ArrowDown size={18} />
          </a>
          <span className="hero-note">Любой уровень. Главное — начать.</span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <img src="/art/hero.svg" alt="" width="640" height="440" />
          <div className="hero-sticker">
            ТВОЙ СЛЕДУЮЩИЙ
            <br />
            <strong>«Я С ВАМИ!»</strong>
            <ArrowUpRight size={28} />
          </div>
          <span className="visual-note">Больше, чем просто спорт</span>
        </div>
      </section>
      <section id="activities" className="catalog-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow muted">Встречаемся в движении</span>
            <h2>
              Найди свою компанию<span className="brand-dot">.</span>
            </h2>
          </div>
          <span className="section-aside">Твой спорт начинается здесь</span>
        </div>
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            setFilter("q", String(data.get("q") ?? "").trim());
          }}
        >
          <label className="search-field">
            <Search size={20} />
            <span className="sr-only">Поиск активностей</span>
            <input
              key={params.get("q") ?? ""}
              name="q"
              defaultValue={params.get("q") ?? ""}
              placeholder="Вид спорта, название или настроение"
            />
          </label>
          <label className="city-field">
            <MapPin size={19} />
            <span className="sr-only">Город</span>
            <select
              value={params.get("city") ?? ""}
              onChange={(event) => setFilter("city", event.target.value)}
            >
              <option value="">Все города</option>
              <option>Москва</option>
              <option>Санкт-Петербург</option>
            </select>
          </label>
          <button className="button primary" type="submit">
            Найти
            <Search size={18} />
          </button>
        </form>
        <div className="sport-tabs" aria-label="Вид спорта">
          {sportOptions.map((sport) => (
            <button
              key={sport.id}
              className={`sport-tab ${(params.get("sportId") ?? "") === sport.id ? "active" : ""}`}
              aria-pressed={(params.get("sportId") ?? "") === sport.id}
              onClick={() => setFilter("sportId", sport.id)}
            >
              {sport.name}
            </button>
          ))}
        </div>
        <div className="catalog-layout">
          <aside className="filters-panel">
            <details open>
              <summary>
                <SlidersHorizontal size={18} />
                Фильтры
                {activeCount > 0 && (
                  <span className="filter-count">{activeCount}</span>
                )}
              </summary>
              <div className="filter-fields">
                <label>
                  Дата от
                  <input
                    type="date"
                    value={params.get("from") ?? ""}
                    onChange={(event) => setFilter("from", event.target.value)}
                  />
                </label>
                <label>
                  Дата до
                  <input
                    type="date"
                    min={params.get("from") ?? undefined}
                    value={params.get("to") ?? ""}
                    onChange={(event) => setFilter("to", event.target.value)}
                  />
                </label>
                <label>
                  Уровень
                  <select
                    value={params.get("skillLevel") ?? ""}
                    onChange={(event) =>
                      setFilter("skillLevel", event.target.value)
                    }
                  >
                    <option value="">Любой</option>
                    <option>Начинающий</option>
                    <option>Средний</option>
                    <option>Любой уровень</option>
                  </select>
                </label>
                <label>
                  Как присоединиться
                  <select
                    value={params.get("joinMode") ?? ""}
                    onChange={(event) =>
                      setFilter("joinMode", event.target.value)
                    }
                  >
                    <option value="">Все варианты</option>
                    <option value="OPEN">Свободная запись</option>
                    <option value="APPROVAL">По заявке</option>
                  </select>
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={params.get("hasSpots") === "true"}
                    onChange={(event) =>
                      setFilter("hasSpots", event.target.checked ? "true" : "")
                    }
                  />
                  Только со свободными местами
                </label>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={params.get("includePast") === "true"}
                    onChange={(event) =>
                      setFilter(
                        "includePast",
                        event.target.checked ? "true" : "",
                      )
                    }
                  />
                  Показать прошедшие
                </label>
                {params.size > 0 && (
                  <button
                    className="reset-button"
                    onClick={() => setParams({})}
                  >
                    <X size={15} />
                    Сбросить всё
                  </button>
                )}
              </div>
            </details>
            <p className="filter-note">
              Не нужен повод.
              <br />
              <strong>Нужна компания.</strong>
            </p>
          </aside>
          <div className="results">
            <div className="results-toolbar">
              <p aria-live="polite">
                {query.data ? (
                  <>
                    Найдено активностей: <strong>{query.data.total}</strong>
                  </>
                ) : (
                  "Ищем активности…"
                )}
              </p>
              <label>
                <span className="sr-only">Сортировка</span>
                <select
                  value={params.get("sort") ?? "startsAt,asc"}
                  onChange={(event) => setFilter("sort", event.target.value)}
                >
                  <option value="startsAt,asc">Сначала ближайшие</option>
                  <option value="startsAt,desc">Сначала поздние</option>
                </select>
              </label>
            </div>
            {query.isPending ? (
              <Skeletons />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : query.data.items.length === 0 ? (
              <EmptyState reset={() => setParams({})} />
            ) : (
              <>
                <div className="event-grid">
                  {query.data.items.map((event) => (
                    <EventCard event={event} key={event.id} />
                  ))}
                </div>
                <nav className="pagination" aria-label="Страницы каталога">
                  <button
                    className="button secondary"
                    disabled={query.data.page <= 0}
                    onClick={() =>
                      setFilter("page", String(query.data.page - 1))
                    }
                  >
                    Назад
                  </button>
                  <span>
                    Страница {query.data.page + 1} из{" "}
                    {Math.max(1, Math.ceil(query.data.total / query.data.size))}
                  </span>
                  <button
                    className="button secondary"
                    disabled={
                      (query.data.page + 1) * query.data.size >=
                      query.data.total
                    }
                    onClick={() =>
                      setFilter("page", String(query.data.page + 1))
                    }
                  >
                    Далее
                  </button>
                </nav>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div>
          <span className="eyebrow muted">Без сложных правил</span>
          <h2>
            Начать проще,
            <br />
            чем кажется.
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>Найди свой спорт</h3>
              <p>Выбери город, дату и комфортный уровень.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>Познакомься со встречей</h3>
              <p>Посмотри место, время и условия организатора.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>Выбери комфортный темп</h3>
              <p>Уровень и условия есть на странице каждой встречи.</p>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}
