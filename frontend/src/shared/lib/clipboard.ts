/** Clipboard API requires a secure origin; the selection fallback also supports LAN HTTP. */
export async function copyText(
  text: string,
  container: HTMLElement = document.body,
): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // A browser may deny the modern API while still allowing an explicit copy gesture.
    }
  }
  const previous = document.activeElement;
  const selection = document.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange(),
      )
    : [];
  const field = document.createElement("textarea");
  field.value = text;
  field.readOnly = true;
  field.tabIndex = -1;
  field.className = "clipboard-selection-helper";
  field.setAttribute("aria-hidden", "true");
  container.append(field);
  try {
    field.focus({ preventScroll: true });
    field.select();
    if (!document.execCommand?.("copy"))
      throw new Error("Clipboard unavailable");
  } finally {
    field.remove();
    if (previous instanceof HTMLElement && previous.isConnected)
      previous.focus({ preventScroll: true });
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) selection.addRange(range);
    }
  }
}
