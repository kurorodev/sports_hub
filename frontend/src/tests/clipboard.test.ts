import { afterEach, describe, expect, it, vi } from "vitest";
import { copyText } from "../shared/lib/clipboard";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe("clipboard", () => {
  it("uses the modern clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    await copyText("@alex");
    expect(writeText).toHaveBeenCalledExactlyOnceWith("@alex");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it.each(["missing", "denied"])(
    "falls back on %s API and restores focus and selection",
    async (mode) => {
      vi.stubGlobal(
        "navigator",
        mode === "missing"
          ? {}
          : {
              clipboard: {
                writeText: vi.fn().mockRejectedValue(new Error("Denied")),
              },
            },
      );
      const container = document.createElement("div");
      const button = document.createElement("button");
      const text = document.createTextNode("Existing selection");
      container.append(button, text);
      document.body.append(container);
      button.focus();
      const range = document.createRange();
      range.selectNodeContents(text);
      document.getSelection()!.removeAllRanges();
      document.getSelection()!.addRange(range);
      const exec = vi.fn(() => {
        const field = container.querySelector("textarea")!;
        expect(field.value).toBe("@alex");
        expect(field.selectionStart).toBe(0);
        expect(field.selectionEnd).toBe(5);
        expect(field).toHaveFocus();
        return true;
      });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: exec,
      });
      try {
        await copyText("@alex", container);
        expect(exec).toHaveBeenCalledExactlyOnceWith("copy");
        expect(button).toHaveFocus();
        expect(document.getSelection()!.toString()).toBe("Existing selection");
        expect(container.querySelector("textarea")).toBeNull();
      } finally {
        container.remove();
        Reflect.deleteProperty(document, "execCommand");
      }
    },
  );

  it("rejects when the fallback fails and removes its temporary field", async () => {
    vi.stubGlobal("navigator", {});
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: vi.fn(() => false),
    });
    try {
      await expect(copyText("@alex")).rejects.toThrow("Clipboard unavailable");
      expect(document.querySelector("textarea")).toBeNull();
    } finally {
      Reflect.deleteProperty(document, "execCommand");
    }
  });
});
