import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Send } from "lucide-react";
import {
  commentErrorMessage,
  useCommentRepository,
} from "../../../entities/comment";
import type { DiscussionComment } from "../../../entities/comment/model";
import { sessionQuery } from "../../../entities/session";
import { FormField } from "../../../shared/ui/FormField";
import {
  publishComment,
  type PublishCommentInput,
} from "../model/publish-comment";
import { MentionInput } from "../../../shared/ui/MentionInput";

const schema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Напишите сообщение")
    .max(2000, "Сообщение — до 2000 символов"),
});
type Values = z.infer<typeof schema>;
export function PublishCommentForm({
  eventId,
  viewerId,
  onPublished,
}: {
  eventId: string;
  viewerId: string;
  onPublished: (comment: DiscussionComment) => void;
}) {
  const repository = useCommentRepository();
  const client = useQueryClient();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { text: "" },
  });
  const mutation = useMutation({
    mutationFn: (input: PublishCommentInput) =>
      publishComment(repository, input),
    onSuccess: (comment, input) => {
      if (
        client.getQueryData(sessionQuery.queryKey)?.user.id !== input.viewerId
      )
        return;
      form.reset();
      onPublished(comment);
    },
  });
  return (
    <form
      className="discussion-form"
      noValidate
      onSubmit={form.handleSubmit((values) =>
        mutation.mutate({ eventId, viewerId, text: values.text }),
      )}
    >
      <FormField
        id="discussion-message"
        label="Ваше сообщение"
        hint="Вопрос или ответ по встрече. Напишите @никнейм, чтобы отметить пользователя. До 2000 символов."
        error={form.formState.errors.text?.message}
      >
        <Controller
          control={form.control}
          name="text"
          render={({ field }) => (
            <MentionInput
              id="discussion-message"
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              rows={4}
              maxLength={2000}
              disabled={mutation.isPending}
              aria-invalid={Boolean(form.formState.errors.text)}
              aria-describedby={
                form.formState.errors.text
                  ? "discussion-message-error"
                  : "discussion-message-hint"
              }
              placeholder="Например: @nickname, придёшь на встречу?"
            />
          )}
        />
      </FormField>
      <div className="discussion-submit">
        <p className="join-note">
          Сообщение публичное. Запись на встречу не требуется.
        </p>
        <button
          className="button primary"
          type="submit"
          disabled={mutation.isPending}
        >
          <Send size={18} />
          {mutation.isPending ? "Отправляем сообщение…" : "Отправить сообщение"}
        </button>
      </div>
      {mutation.isError && (
        <p className="field-error" role="alert">
          {commentErrorMessage(mutation.error)} Текст сохранён.
        </p>
      )}
    </form>
  );
}
