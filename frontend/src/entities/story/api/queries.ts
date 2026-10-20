import { queryOptions } from "@tanstack/react-query";
import { ApiError, apiConfig, request } from "../../../shared/api/client";
import type {
  ApiErrorBody,
  Story,
  StoryCreate,
  StoryFeed,
} from "../../../shared/api/types";

export const storiesQuery = (viewerId: string) =>
  queryOptions({
    queryKey: ["stories", viewerId],
    queryFn: ({ signal }) => request<StoryFeed>("/stories", { signal }),
    staleTime: 15_000,
    refetchInterval: 30_000,
    retry: false,
  });
export const publishStory = (input: StoryCreate) =>
  request<Story>("/admin/stories", {
    method: "POST",
    body: JSON.stringify(input),
  });
export const deleteStory = (id: string) =>
  request<void>(`/admin/stories/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
export const viewStory = (id: string) =>
  request<Story>(`/stories/${encodeURIComponent(id)}/view`, { method: "POST" });
export function storyImage(story: Story) {
  if (!story.imageUrl) return undefined;
  return `${apiConfig.baseUrl}/stories/${encodeURIComponent(story.id)}/image`;
}

export async function fetchStoryImage(story: Story, signal: AbortSignal) {
  const url = storyImage(story);
  if (!url) throw new Error("У сторис нет изображения");
  let response: Response;
  try {
    response = await fetch(url, { signal, credentials: "include" });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new ApiError(0);
  }
  if (!response.ok) {
    const body: ApiErrorBody | undefined = await response
      .json()
      .catch(() => undefined);
    throw new ApiError(response.status, body);
  }
  return response.blob();
}
