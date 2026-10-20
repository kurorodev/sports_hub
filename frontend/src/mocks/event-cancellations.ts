const key = "sport.mock.event-cancellations.v1";
let memory: Record<string, string> = {};
function records(): Record<string, string> {
  const saved =
    typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  return saved ? JSON.parse(saved) : memory;
}
export function eventCancelledAt(id: string): string | undefined {
  return records()[id];
}
export function cancelMockEvent(id: string): void {
  memory = { ...records(), [id]: new Date().toISOString() };
  if (typeof localStorage !== "undefined")
    localStorage.setItem(key, JSON.stringify(memory));
}
export function resetEventCancellations(): void {
  memory = {};
  if (typeof localStorage !== "undefined") localStorage.removeItem(key);
}
