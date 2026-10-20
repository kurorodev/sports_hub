import { sessionQuery } from "../../../entities/session";
import { tr } from "../../../shared/i18n/translate";
import { useLocale } from "../../../shared/i18n/use-preferences";
import { useCurrentLocation } from "../../../shared/lib/current-location-context";
import { DistanceFilter } from "../../../shared/ui/DistanceFilter";
import { registrationPresentation } from "../../../entities/registration";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  ChevronDown,
  Plus,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { eventsQuery, sportsQuery, sportIcon } from "../../../entities/event";
import { EventCard } from "../../../entities/event";
import { errorMessage } from "../../../shared/api/client";
import { EmptyState, ErrorState, Skeletons } from "../../../shared/ui/Feedback";
import { ActivityViewSwitch } from "../../../shared/ui/ActivityViewSwitch";
import { DateRangeFields } from "../../../shared/ui/DateRangeFields";
import { SearchableSelect } from "../../../shared/ui/SearchableSelect";
import { Select } from "../../../shared/ui/Select";
import { useEffect, useState } from "react";
import { canonicalCityName, russianCities } from "../../../shared/lib/cities";

export function CatalogPage() {
  const session = useQuery(sessionQuery);
  const isAdmin = session.data?.systemRoles.includes("ADMIN");
  useLocale();
  const [params, setParams] = useSearchParams();
  const searchTerm = params.get("q") ?? "";
  const [search, setSearch] = useState({
    applied: searchTerm,
    value: searchTerm,
  });
  const [isComposing, setIsComposing] = useState(false);
  // Restore URL navigation without replacing the input or moving its caret while typing.
  if (search.applied !== searchTerm) {
    setSearch({
      applied: searchTerm,
      value: search.value.trim() === searchTerm ? search.value : searchTerm,
    });
  }
  useEffect(() => {
    const value = search.value.trim();
    if (isComposing || value === searchTerm) return;
    const timeout = window.setTimeout(
      () => {
        setParams(
          (current) => {
            const next = new URLSearchParams(current);
            if (value) next.set("q", value);
            else next.delete("q");
            next.delete("page");
            return next;
          },
          { replace: true },
        );
      },
      value ? 300 : 0,
    );
    return () => window.clearTimeout(timeout);
  }, [search.value, searchTerm, isComposing, setParams]);
  const resetFilters = () => {
    setSearch({ applied: "", value: "" });
    setParams({});
  };
  const { position } = useCurrentLocation();
  const needsLocation = params.has("radiusMeters") && !position;
  const requestedCity = params.get("city") ?? "";
  const city = canonicalCityName(requestedCity) ?? "";
  const filters = new URLSearchParams(params);
  if (city) filters.set("city", city);
  else filters.delete("city");
  const query = useQuery({
    ...eventsQuery(filters, position),
    placeholderData: keepPreviousData,
  });
  const sports = useQuery(sportsQuery);
  const cities = city
    ? [city, ...russianCities.filter((name) => name !== city)]
    : russianCities;
  useEffect(() => {
    if (requestedCity === city) return;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (city) next.set("city", city);
        else next.delete("city");
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }, [requestedCity, city, setParams]);
  const sportOptions = [
    { id: "", name: tr("Все виды спорта"), imageUrl: undefined },
    ...(sports.data ?? []).filter(
      (sport) =>
        [
          "Легкая атлетика",
          "Баскетбол",
          "Футбол",
          "Теннис",
          "Шахматы",
          "Другое",
        ].includes(sport.name) ||
        (!sport.registryCode && !sport.isCustom),
    ),
  ];
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
    "radiusMeters",
  ].filter((key) => params.has(key)).length;
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="live-dot" />
            {tr("Люди. Спорт. Твой ритм.")}
          </span>
          <h1>
            {tr("Вместе —")}
            <br />
            {tr("больше ")}
            <span>{tr("спорта.")}</span>
          </h1>
          <p>
            {tr("Найди компанию для спорта.")}
            <br />
            {tr("От первой пробежки до игры на равных.")}
          </p>
          <a className="button primary" href="#activities">
            {tr("Выбрать активность")}
            <ArrowDown size={18} />
          </a>
          <span className="hero-note">
            {tr("Любой уровень. Главное — начать.")}
          </span>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <img
            src="/art/sports/panorama.jpg"
            alt=""
            width="1672"
            height="941"
            fetchPriority="high"
          />
          <div className="hero-sticker">
            {tr("ТВОЙ СЛЕДУЮЩИЙ")}
            <br />
            <strong>{tr("«Я С ВАМИ!»")}</strong>
            <ArrowUpRight size={28} />
          </div>
          <span className="visual-note">{tr("Больше, чем просто спорт")}</span>
        </div>
      </section>
      <section id="activities" className="catalog-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow muted">{tr("Занимайтесь вместе")}</span>
            <h2>
              {tr("Найди свою компанию")}
              <span className="brand-dot">.</span>
            </h2>
          </div>
          {!isAdmin && (
            <Link className="button primary catalog-create" to="/events/new">
              <Plus size={18} aria-hidden="true" />
              {tr("Создать встречу")}
            </Link>
          )}
        </div>
        <ActivityViewSwitch view="list" params={params} />
        <form
          className="search-bar"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isComposing) setFilter("q", search.value.trim());
          }}
        >
          <label className="search-field">
            <Search size={20} />
            <span className="sr-only">{tr("Поиск активностей")}</span>
            <input
              name="q"
              value={search.value}
              onChange={(event) => {
                const value = event.target.value;
                setSearch((current) => ({ ...current, value }));
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              placeholder={tr("Название или описание встречи")}
            />
          </label>
          <div className="city-field">
            <MapPin size={19} />
            <SearchableSelect
              id="catalog-city"
              aria-label={tr("Город")}
              value={city}
              onChange={(value) => setFilter("city", value)}
              options={[
                { id: "", name: tr("Все города") },
                ...cities.map((name) => ({ id: name, name })),
              ]}
              matchFromStart
              maxOptions={3}
              searchLabel={tr("Поиск города")}
              searchPlaceholder={tr("Введите город…")}
              listLabel={tr("Города")}
              placeholder={tr("Все города")}
              hint={tr(
                "Начните вводить название и выберите город из подсказок",
              )}
            />
          </div>
          <button className="button primary" type="submit">
            {tr("Найти")}
            <Search size={18} />
          </button>
        </form>
        <div className="sport-tabs" aria-label={tr("Вид спорта")}>
          {sportOptions.map((sport) => (
            <button
              key={sport.id}
              className={`sport-tab ${(params.get("sportId") ?? "") === sport.id ? "active" : ""}`}
              aria-pressed={(params.get("sportId") ?? "") === sport.id}
              onClick={() => setFilter("sportId", sport.id)}
            >
              {(sport.imageUrl || sportIcon(sport.name)) && (
                <img
                  src={sport.imageUrl || sportIcon(sport.name)}
                  alt=""
                  width="28"
                  height="28"
                />
              )}
              {sport.id ? sport.name : tr(sport.name)}
            </button>
          ))}
        </div>
        {sports.isPending && (
          <p className="sports-feedback" role="status">
            {tr("Загружаем виды спорта…")}
          </p>
        )}
        {sports.isError && (
          <div className="sports-feedback" role="alert">
            <p>{tr(errorMessage(sports.error))}</p>
            <button
              className="reset-button"
              onClick={() => void sports.refetch()}
            >
              {tr("Повторить загрузку видов спорта")}
            </button>
          </div>
        )}
        <div className="catalog-layout">
          <div className="filters-panel">
            <details>
              <summary>
                <SlidersHorizontal size={18} />
                {tr("Фильтры")}
                {activeCount > 0 && (
                  <span className="filter-count">{activeCount}</span>
                )}
                <ChevronDown
                  className="filters-chevron"
                  size={18}
                  aria-hidden="true"
                />
              </summary>
              <div className="filter-fields">
                <div className="form-field">
                  <label htmlFor="catalog-sport">{tr("Вид спорта")}</label>
                  <SearchableSelect
                    id="catalog-sport"
                    value={params.get("sportId") ?? ""}
                    options={[
                      {
                        id: "",
                        name: tr("Все виды спорта"),
                        imageUrl: undefined,
                      },
                      ...(sports.data ?? []).map((sport) => ({
                        ...sport,
                        imageUrl: sport.imageUrl || sportIcon(sport.name),
                      })),
                    ]}
                    onChange={(value) => setFilter("sportId", value)}
                    disabled={sports.isPending}
                  />
                </div>
                <DateRangeFields
                  from={params.get("from") ?? ""}
                  to={params.get("to") ?? ""}
                  onChange={setFilter}
                />
                <div className="form-field">
                  <label htmlFor="catalog-level">{tr("Уровень")}</label>
                  <SearchableSelect
                    id="catalog-level"
                    searchable={false}
                    value={params.get("skillLevel") ?? ""}
                    onChange={(value) => setFilter("skillLevel", value)}
                    options={[
                      { id: "", name: tr("Любой") },
                      { id: "BEGINNER", name: tr("Начинающий") },
                      { id: "AMATEUR", name: tr("Любитель") },
                      { id: "ADVANCED", name: tr("Продвинутый") },
                      { id: "PROFESSIONAL", name: tr("Профессиональный") },
                      { id: "ANY", name: tr("Любой уровень") },
                    ]}
                    searchLabel={tr("Поиск уровня")}
                    placeholder={tr("Выберите уровень")}
                    searchPlaceholder={tr("Найти уровень…")}
                    listLabel={tr("Уровни подготовки")}
                    hint={tr("Выберите уровень подготовки")}
                  />
                </div>
                <label>
                  {tr("Как присоединиться")}
                  <Select
                    value={params.get("joinMode") ?? ""}
                    onChange={(event) =>
                      setFilter("joinMode", event.target.value)
                    }
                  >
                    <option value="">{tr("Все варианты")}</option>
                    <option value="OPEN">{tr("Свободная запись")}</option>
                    <option value="APPROVAL">{tr("По заявке")}</option>
                  </Select>
                </label>
                <div className="filter-extras">
                  <DistanceFilter
                    value={params.get("radiusMeters") ?? ""}
                    onChange={(value) => setFilter("radiusMeters", value)}
                  />
                  <div className="filter-actions">
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={params.get("hasSpots") === "true"}
                        onChange={(event) =>
                          setFilter(
                            "hasSpots",
                            event.target.checked ? "true" : "",
                          )
                        }
                      />
                      {tr("Только со свободными местами")}
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
                      {tr("Показать прошедшие")}
                    </label>
                    {params.size > 0 && (
                      <button className="reset-button" onClick={resetFilters}>
                        <X size={15} />
                        {tr("Сбросить всё")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </details>
          </div>
          <div className="results" aria-busy={query.isFetching}>
            <div className="results-toolbar">
              <p aria-live="polite">
                {needsLocation ? (
                  tr("Укажите геопозицию для поиска рядом")
                ) : query.isFetching ? (
                  tr("Ищем активности…")
                ) : query.data ? (
                  <>
                    {tr("Найдено активностей: ")}
                    <strong>{query.data.total}</strong>
                  </>
                ) : (
                  tr("Ищем активности…")
                )}
              </p>
              <label>
                <span className="sr-only">{tr("Сортировка")}</span>
                <Select
                  value={params.get("sort") ?? "startsAt,asc"}
                  onChange={(event) => setFilter("sort", event.target.value)}
                >
                  <option value="startsAt,asc">
                    {tr("Дата: сначала ранние")}
                  </option>
                  <option value="startsAt,desc">
                    {tr("Дата: сначала поздние")}
                  </option>
                </Select>
              </label>
            </div>
            {needsLocation ? (
              <p className="notice" role="status">
                {tr(
                  "Включите геолокацию в фильтре «Рядом со мной», чтобы найти мероприятия в выбранном радиусе.",
                )}
              </p>
            ) : query.isPending ? (
              <Skeletons />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                retry={() => void query.refetch()}
              />
            ) : query.data.items.length === 0 ? (
              <EmptyState canCreate={!isAdmin} reset={resetFilters} />
            ) : (
              <>
                <div className="event-grid">
                  {query.data.items.map((event) => (
                    <EventCard
                      event={event}
                      key={event.id}
                      participation={
                        event.viewerRegistrationStatus
                          ? registrationPresentation[
                              event.viewerRegistrationStatus
                            ]
                          : undefined
                      }
                    />
                  ))}
                </div>
                <nav
                  className="pagination"
                  aria-label={tr("Страницы каталога")}
                >
                  <button
                    className="button secondary"
                    disabled={query.isPlaceholderData || query.data.page <= 0}
                    onClick={() =>
                      setFilter("page", String(query.data.page - 1))
                    }
                  >
                    {tr("Назад")}
                  </button>
                  <span>
                    {tr("Страница ")}
                    {query.data.page + 1}
                    {tr(" из")}{" "}
                    {Math.max(1, Math.ceil(query.data.total / query.data.size))}
                  </span>
                  <button
                    className="button secondary"
                    disabled={
                      query.isPlaceholderData ||
                      (query.data.page + 1) * query.data.size >=
                        query.data.total
                    }
                    onClick={() =>
                      setFilter("page", String(query.data.page + 1))
                    }
                  >
                    {tr("Далее")}
                  </button>
                </nav>
              </>
            )}
          </div>
        </div>
      </section>
      <section className="how-section" id="how-it-works">
        <div>
          <span className="eyebrow muted">{tr("Без сложных правил")}</span>
          <h2>
            {tr("Начать проще,")}
            <br />
            {tr("чем кажется.")}
          </h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <div>
              <h3>{tr("Найди свой спорт")}</h3>
              <p>{tr("Выбери город, дату и комфортный уровень.")}</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <h3>{tr("Познакомься со встречей")}</h3>
              <p>{tr("Посмотри место, время и условия организатора.")}</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <h3>{tr("Выбери комфортный темп")}</h3>
              <p>{tr("Уровень и условия есть на странице каждой встречи.")}</p>
            </div>
          </li>
        </ol>
      </section>
    </>
  );
}
