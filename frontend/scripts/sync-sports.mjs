import { readFile, writeFile, mkdir } from "node:fs/promises";

const source = new URL(
  "../../backend/src/main/resources/sports-registry.json",
  import.meta.url,
);
const target = new URL(
  "../src/mocks/generated/sports-registry.json",
  import.meta.url,
);
const data = await readFile(source, "utf8");
if (process.argv.includes("--check")) {
  if ((await readFile(target, "utf8")) !== data)
    throw new Error("Run npm run sports:generate");
} else {
  await mkdir(new URL(".", target), { recursive: true });
  await writeFile(target, data);
}
