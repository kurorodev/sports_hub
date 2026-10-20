import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStoryImage } from "../../../entities/story";
import type { Story } from "../../../shared/api/types";

type Entry = {
  controller: AbortController;
  promise: Promise<string>;
  url?: string;
};

/** Session-scoped media cache: thumbnails and slides share one fetched image. */
export function useStoryImages(stories: readonly Story[]) {
  const entries = useRef(new Map<string, Entry>());
  const [images, setImages] = useState<Record<string, string>>({});
  const load = useCallback((story: Story): Promise<string> => {
    const previous = entries.current.get(story.id);
    if (previous) return previous.promise;
    const controller = new AbortController();
    const entry: Entry = { controller, promise: Promise.resolve("") };
    entry.promise = fetchStoryImage(story, controller.signal)
      .then((blob) => {
        if (controller.signal.aborted)
          throw new DOMException("Aborted", "AbortError");
        const url = URL.createObjectURL(blob);
        entry.url = url;
        setImages((current) => ({ ...current, [story.id]: url }));
        return url;
      })
      .catch((error: unknown) => {
        if (entries.current.get(story.id) === entry)
          entries.current.delete(story.id);
        throw error;
      });
    entries.current.set(story.id, entry);
    return entry.promise;
  }, []);
  useEffect(() => {
    const cache = entries.current;
    return () => {
      for (const entry of cache.values()) {
        entry.controller.abort();
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
      cache.clear();
    };
  }, []);
  useEffect(() => {
    const ids = new Set(stories.map((story) => story.id));
    const removed: string[] = [];
    for (const [id, entry] of entries.current) {
      if (ids.has(id)) continue;
      entry.controller.abort();
      if (entry.url) URL.revokeObjectURL(entry.url);
      entries.current.delete(id);
      removed.push(id);
    }
    if (removed.length)
      setImages((current) =>
        Object.fromEntries(
          Object.entries(current).filter(([id]) => !removed.includes(id)),
        ),
      );
    for (const story of stories) {
      if (story.imageUrl) void load(story).catch(() => undefined);
    }
  }, [stories, load]);
  return { images, load };
}
