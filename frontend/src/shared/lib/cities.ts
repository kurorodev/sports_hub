import directory from "../model/russian-cities.json";

export const russianCities: readonly string[] = directory.cities;

function normalize(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("ru")
    .replaceAll("ё", "е");
}

const cityNames = new Map(russianCities.map((name) => [normalize(name), name]));

export function canonicalCityName(value: string): string | undefined {
  return cityNames.get(normalize(value));
}
