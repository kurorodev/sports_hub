import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { Info, X } from "lucide-react";

/** An interactive, nonmodal preview. Hover/focus opens; the info button also works on touch. */
export function HoverCard({
  label,
  triggerLabel,
  trigger,
  children,
}: {
  label: string;
  triggerLabel: string;
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hovered = useRef(false);
  const pinned = useRef(false);
  const focusOnOpen = useRef(false);
  const restoringFocus = useRef(false);
  function cancelClose() {
    clearTimeout(timer.current);
  }
  function close(restore = false) {
    cancelClose();
    pinned.current = false;
    focusOnOpen.current = false;
    setOpen(false);
    if (restore) {
      restoringFocus.current = true;
      button.current?.focus({ preventScroll: true });
      restoringFocus.current = false;
    }
  }
  function scheduleClose() {
    cancelClose();
    timer.current = setTimeout(() => {
      const active = document.activeElement;
      if (
        !hovered.current &&
        !pinned.current &&
        !anchor.current?.contains(active) &&
        !panel.current?.contains(active)
      )
        setOpen(false);
    }, 180);
  }
  useEffect(() => () => clearTimeout(timer.current), []);
  useLayoutEffect(() => {
    if (!open) return;
    const element = panel.current;
    if (!element) return;
    function place() {
      if (!anchor.current) return;
      const bounds = anchor.current.getBoundingClientRect();
      const card = element!.getBoundingClientRect();
      const margin = 12,
        gap = 8;
      const left = Math.max(
        margin,
        Math.min(bounds.left, innerWidth - card.width - margin),
      );
      const below = bounds.bottom + gap;
      const preferredTop =
        below + card.height <= innerHeight - margin
          ? below
          : bounds.top - card.height - gap;
      const top = Math.max(
        margin,
        Math.min(preferredTop, innerHeight - card.height - margin),
      );
      element!.style.left = `${left}px`;
      element!.style.top = `${top}px`;
    }
    place();
    const observer =
      typeof ResizeObserver === "undefined"
        ? undefined
        : new ResizeObserver(place);
    observer?.observe(element);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    if (focusOnOpen.current) {
      element.focus({ preventScroll: true });
      focusOnOpen.current = false;
    }
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !anchor.current?.contains(event.target) &&
        !panel.current?.contains(event.target)
      ) {
        pinned.current = false;
        clearTimeout(timer.current);
        setOpen(false);
      }
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        pinned.current = false;
        clearTimeout(timer.current);
        setOpen(false);
        if (panel.current?.contains(document.activeElement)) {
          restoringFocus.current = true;
          button.current?.focus({ preventScroll: true });
          restoringFocus.current = false;
        }
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <span
      className="hover-card-anchor"
      ref={anchor}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          hovered.current = true;
          cancelClose();
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType !== "touch") {
          hovered.current = false;
          scheduleClose();
        }
      }}
      onFocusCapture={() => {
        if (!restoringFocus.current) {
          cancelClose();
          setOpen(true);
        }
      }}
      onBlurCapture={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          (anchor.current?.contains(event.relatedTarget) ||
            panel.current?.contains(event.relatedTarget))
        )
          return;
        pinned.current = false;
        scheduleClose();
      }}
    >
      {trigger}
      <button
        ref={button}
        className="hover-card-trigger"
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => {
          if (pinned.current && open) close(true);
          else {
            pinned.current = true;
            cancelClose();
            focusOnOpen.current = true;
            setOpen(true);
            if (open) {
              panel.current?.focus({ preventScroll: true });
              focusOnOpen.current = false;
            }
          }
        }}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            className="hover-card"
            role="dialog"
            aria-label={label}
            tabIndex={-1}
            onPointerEnter={(event) => {
              if (event.pointerType !== "touch") {
                hovered.current = true;
                cancelClose();
              }
            }}
            onPointerLeave={(event) => {
              if (event.pointerType !== "touch") {
                hovered.current = false;
                scheduleClose();
              }
            }}
          >
            <button
              type="button"
              className="hover-card-close"
              aria-label="Закрыть карточку организатора"
              onClick={() => close(true)}
            >
              <X size={18} aria-hidden="true" />
            </button>
            {children}
          </div>,
          document.body,
        )}
    </span>
  );
}
