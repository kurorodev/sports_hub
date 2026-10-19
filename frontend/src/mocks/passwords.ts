// Mock-only password storage. Real mode never imports or verifies credentials in the browser.
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    new Uint8Array(
      await crypto.subtle.deriveBits(
        {
          name: "PBKDF2",
          hash: "SHA-256",
          iterations: 310000,
          salt: salt.buffer as ArrayBuffer,
        },
        key,
        256,
      ),
    ),
  );
}
export async function hashMockPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${hex(salt)}:${await derive(password, salt)}`;
}
export async function verifyMockPassword(password: string, encoded: string) {
  const [salt, hash] = encoded.split(":");
  if (!/^[a-f0-9]{32}$/.test(salt ?? "") || !/^[a-f0-9]{64}$/.test(hash ?? ""))
    return false;
  const bytes = Uint8Array.from(salt.match(/../g)!, (s) => parseInt(s, 16));
  return (await derive(password, bytes)) === hash;
}
