const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("ru").replaceAll("ё", "е");

/** Мок повторяет ограничения EventTextSearch: одна опечатка и ограниченный размер запроса. */
export function matchesEventSearch(
  query: string,
  fields: (string | null | undefined)[],
) {
  const text = normalize(query);
  const values = fields.map((field) => normalize(field ?? ""));
  if (values.some((value) => value.includes(text))) return true;
  const words = text.split(/\s+/u);
  if (
    text.length > 64 ||
    words.length > 4 ||
    !/^[\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+)*$/u.test(text)
  )
    return false;
  return words.every((word) => {
    if (word.length < 5 || word.length > 24)
      return values.some((value) => value.includes(word));
    const patterns = new Set([word]);
    for (let i = 0; i < word.length; i++) {
      patterns.add(word.slice(0, i) + "_" + word.slice(i + 1));
      patterns.add(word.slice(0, i) + word.slice(i + 1));
      if (i + 1 < word.length)
        patterns.add(
          word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2),
        );
    }
    for (let i = 0; i <= word.length; i++)
      patterns.add(word.slice(0, i) + "_" + word.slice(i));
    return [...patterns].some((pattern) => {
      const expression = new RegExp(pattern.replaceAll("_", "."), "su");
      return values.some((value) => expression.test(value));
    });
  });
}
