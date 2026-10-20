import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Trash2,
  X,
  LoaderCircle,
} from "lucide-react";
import { viewStory } from "../../../entities/story";
import type { Story } from "../../../shared/api/types";
import { ApiError } from "../../../shared/api/client";
import { Dialog } from "../../../shared/ui/Dialog";
import { tr } from "../../../shared/i18n/translate";

type StoryViewerProps = {
  story: Story;
  cachedImage?: string;
  loadImage: (story: Story) => Promise<string>;
  index: number;
  count: number;
  admin: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onClose: () => void;
  onViewed: (story: Story) => void;
  onRemoved: () => Promise<void>;
  onDelete: () => void;
  deleting: boolean;
  deleteError?: string;
};

export function StoryViewer(props: StoryViewerProps) {
  const titleId = useId();
  const confirmationId = useId();
  const [confirming, setConfirming] = useState(false);
  const [closeBlocked, setCloseBlocked] = useState(false);
  // Keep the modal and its backdrop mounted; reset only the slide between stories.
  return (
    <Dialog
      labelledBy={confirming ? confirmationId : titleId}
      onClose={() => {
        if (props.deleting || closeBlocked) return;
        if (confirming) setConfirming(false);
        else props.onClose();
      }}
      className={confirming ? "story-delete-dialog" : "story-viewer-dialog"}
    >
      <div hidden={confirming}>
        <StorySlide
          key={props.story.id}
          {...props}
          confirming={confirming}
          onDelete={() => setConfirming(true)}
          titleId={titleId}
          onCloseBlocked={setCloseBlocked}
        />
      </div>
      {confirming && (
        <>
          <h2 id={confirmationId}>{tr("Удалить историю?")}</h2>
          <p>
            {tr(
              "История будет удалена у всех пользователей. Восстановить её не получится.",
            )}
          </p>
          {props.deleteError && (
            <p className="field-error" role="alert">
              {props.deleteError}
            </p>
          )}
          <div className="story-delete-actions">
            <button
              type="button"
              className="button secondary"
              autoFocus
              disabled={props.deleting}
              onClick={() => setConfirming(false)}
            >
              {tr("Отмена")}
            </button>
            <button
              type="button"
              className="button danger-button"
              disabled={props.deleting}
              onClick={props.onDelete}
            >
              {props.deleting ? tr("Удаляем…") : tr("Удалить")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function StorySlide({
  story,
  cachedImage,
  loadImage,
  index,
  count,
  admin,
  onPrevious,
  onNext,
  onClose,
  onViewed,
  onRemoved,
  onDelete,
  deleting,
  deleteError,
  confirming,
  titleId,
  onCloseBlocked,
}: StoryViewerProps & {
  titleId: string;
  confirming: boolean;
  onCloseBlocked: (blocked: boolean) => void;
}) {
  const slide = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(!story.imageUrl);
  const [imageError, setImageError] = useState(false);
  const [imageUrl, setImageUrl] = useState(cachedImage);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const [background, setBackground] = useState(document.hidden);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const touch = useRef<{ x: number; y: number; at: number } | null>(null);
  useEffect(() => {
    if (!story.imageUrl || imageUrl || imageError) return;
    let current = true;
    void loadImage(story)
      .then((url) => {
        if (current) setImageUrl(url);
      })
      .catch(() => {
        if (current) setImageError(true);
      });
    return () => {
      current = false;
    };
  }, [story, imageUrl, imageError, loadImage]);
  const viewed = useMutation({
    mutationFn: viewStory,
    onSuccess: onViewed,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) void onRemoved();
    },
  });
  const { mutate: markViewed } = viewed;
  useLayoutEffect(() => {
    if (!confirming) slide.current?.focus({ preventScroll: true });
  }, [confirming]);
  useEffect(() => {
    onCloseBlocked(deleting);
    return () => onCloseBlocked(false);
  }, [deleting, onCloseBlocked]);
  const isPaused =
    paused ||
    holding ||
    background ||
    deleting ||
    confirming ||
    Boolean(deleteError) ||
    imageError ||
    !ready;
  useEffect(() => {
    if (ready) markViewed(story.id);
  }, [ready, story.id, markViewed]);
  useEffect(() => {
    const update = () => setBackground(document.hidden);
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  useEffect(() => {
    if (isPaused) return;
    let previous = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      elapsed.current += now - previous;
      previous = now;
      setProgress(Math.min(100, elapsed.current / 80));
      if (elapsed.current >= 8000) {
        window.clearInterval(timer);
        onNext();
      }
    }, 50);
    return () => window.clearInterval(timer);
  }, [isPaused, onNext]);
  return (
    <div
      ref={slide}
      tabIndex={-1}
      className="story-viewer"
      onKeyDown={(event) => {
        if (deleting || confirming) return;
        if (event.key === "ArrowRight") {
          event.preventDefault();
          onNext();
        }
        if (event.key === "ArrowLeft" && index > 0) {
          event.preventDefault();
          onPrevious();
        }
      }}
    >
      <h2 id={titleId} className="sr-only">
        {tr("История {0} из {1}", [index + 1, count])}
      </h2>
      <div
        className="story-progress"
        role="group"
        aria-label={tr("История {0} из {1}", [index + 1, count])}
      >
        {Array.from({ length: count }, (_, i) => (
          <span key={i}>
            <span
              style={{
                width: `${i < index ? 100 : i === index ? progress : 0}%`,
              }}
            />
          </span>
        ))}
      </div>
      <header className="story-viewer-heading">
        <button
          type="button"
          className="story-icon-button"
          aria-label={
            paused ? tr("Продолжить историю") : tr("Приостановить историю")
          }
          aria-pressed={paused}
          disabled={deleting}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play size={20} /> : <Pause size={20} />}
        </button>
        {admin && (
          <button
            type="button"
            className="story-icon-button"
            aria-label={tr("Удалить историю")}
            disabled={deleting}
            onClick={onDelete}
          >
            {deleting ? (
              <LoaderCircle size={20} className="story-deleting" />
            ) : (
              <Trash2 size={20} />
            )}
          </button>
        )}
        <button
          type="button"
          className="story-icon-button"
          aria-label={tr("Закрыть историю")}
          disabled={deleting}
          onClick={onClose}
        >
          <X size={24} />
        </button>
      </header>
      <div
        className="story-content"
        onPointerDown={(event) => {
          if (
            !event.isPrimary ||
            event.button !== 0 ||
            (event.target instanceof Element &&
              event.target.closest("button, a, input, textarea, select"))
          )
            return;
          touch.current = {
            x: event.clientX,
            y: event.clientY,
            at: performance.now(),
          };
          setHolding(true);
        }}
        onPointerUp={(event) => {
          setHolding(false);
          if (!touch.current) return;
          const start = touch.current;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          touch.current = null;
          if (deleting || confirming) return;
          if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
            if (dx < 0) onNext();
            else if (index > 0) onPrevious();
            return;
          }
          if (
            Math.abs(dx) > 10 ||
            Math.abs(dy) > 10 ||
            performance.now() - start.at > 300 ||
            window.getSelection()?.toString()
          )
            return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX - bounds.left < bounds.width / 2) {
            if (index > 0) onPrevious();
          } else onNext();
        }}
        onPointerCancel={() => {
          touch.current = null;
          setHolding(false);
        }}
        onPointerLeave={() => {
          touch.current = null;
          setHolding(false);
        }}
      >
        {imageUrl && !imageError && (
          <img
            className="story-image"
            draggable={false}
            src={imageUrl}
            alt={tr("Фото истории")}
            onLoad={() => setReady(true)}
            onError={() => setImageError(true)}
          />
        )}
        {story.imageUrl && !ready && !imageError && (
          <div
            className="story-image-loader"
            role="status"
            aria-label={tr("Загружаем изображение…")}
          >
            <LoaderCircle size={32} aria-hidden="true" />
          </div>
        )}
        {imageError && (
          <div className="story-image-status" role="alert">
            <p>
              {tr(
                "Изображение недоступно. История могла быть удалена или срок показа истёк.",
              )}
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setImageError(false);
                setReady(false);
                setImageUrl(undefined);
              }}
            >
              {tr("Повторить")}
            </button>
          </div>
        )}
      </div>
      <footer className="story-viewer-footer">
        <button
          className="story-icon-button"
          type="button"
          aria-label={tr("Предыдущая история")}
          disabled={index === 0 || deleting}
          onClick={onPrevious}
        >
          <ChevronLeft size={26} />
        </button>
        <button
          className="story-icon-button"
          type="button"
          aria-label={
            index + 1 === count
              ? tr("Завершить просмотр")
              : tr("Следующая история")
          }
          disabled={deleting}
          onClick={onNext}
        >
          <ChevronRight size={26} />
        </button>
      </footer>
      {viewed.isError &&
        !(viewed.error instanceof ApiError && viewed.error.status === 404) && (
          <div className="story-save-error" role="alert">
            <span>{tr("Не удалось сохранить просмотр.")}</span>
            <button type="button" onClick={() => markViewed(story.id)}>
              {tr("Повторить")}
            </button>
          </div>
        )}
      {deleteError && (
        <div className="story-save-error" role="alert">
          <span>{deleteError}</span>
          <button type="button" onClick={onDelete} disabled={deleting}>
            {tr("Повторить")}
          </button>
        </div>
      )}
    </div>
  );
}
