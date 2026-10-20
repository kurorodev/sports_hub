import { z } from "zod";
import { canonicalCityName } from "../lib/cities";

export const citySchema = z
  .string()
  .trim()
  .refine(
    (value) => Boolean(canonicalCityName(value)),
    "Выберите город из подсказок",
  )
  .transform((value) => canonicalCityName(value)!);

export const optionalCitySchema = z
  .string()
  .trim()
  .refine(
    (value) => !value || Boolean(canonicalCityName(value)),
    "Выберите город из подсказок",
  )
  .transform((value) => canonicalCityName(value) ?? "");
