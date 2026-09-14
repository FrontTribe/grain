"use client";

import { useCallback, useEffect, useId, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

// Build the next querystring from the current params, setting/clearing one key.
function withParam(params: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(params.toString());
  if (value) next.set(key, value);
  else next.delete(key);
  return next.toString();
}

const shell =
  "inline-flex items-center gap-2 rounded-lg border bg-surface px-3 py-1.5 text-[13px] transition-colors";

/* ------------------------------------------------------------------ */
/* Search                                                              */
/* ------------------------------------------------------------------ */

/** Debounced search box that reflects its value into a URL search param (?q= by default). */
export function SearchInput({
  placeholder,
  param = "q",
  width = 190,
}: {
  placeholder: string;
  param?: string;
  width?: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [pending, startTransition] = useTransition();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      const qs = withParam(params, param, value.trim());
      startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span className={`${shell} border-line text-muted focus-within:border-brand focus-within:text-ink`}>
      {pending ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-[15px] animate-spin text-brand">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[15px] text-faint">
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      )}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        style={{ width }}
        className="bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue("")}
          aria-label="Clear search"
          className="-mr-1 flex size-4 items-center justify-center rounded text-faint transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Custom dropdown (accessible listbox — no native <select>)          */
/* ------------------------------------------------------------------ */

export function Select({
  value,
  options,
  onChange,
  mono = false,
  align = "left",
  ariaLabel,
  maxLabel = 180,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  mono?: boolean;
  align?: "left" | "right";
  ariaLabel?: string;
  maxLabel?: number;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value) ?? options[0];
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  const close = useCallback(() => setOpen(false), []);
  const openMenu = () => {
    setActive(selectedIndex);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open, close]);

  // keep the active option scrolled into view
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const commit = (v: string) => {
    onChange(v);
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open) openMenu();
        else setActive((a) => Math.min(options.length - 1, a + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((a) => Math.max(0, a - 1));
        break;
      case "Home":
        if (open) { e.preventDefault(); setActive(0); }
        break;
      case "End":
        if (open) { e.preventDefault(); setActive(options.length - 1); }
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) commit(options[active].value);
        else openMenu();
        break;
      case "Escape":
        if (open) { e.preventDefault(); close(); }
        break;
      case "Tab":
        close();
        break;
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={onKeyDown}
        className={`${shell} ${open ? "border-brand text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"} ${mono ? "font-mono text-xs" : ""}`}
      >
        <span className="truncate" style={{ maxWidth: maxLabel }}>{selected?.label}</span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className={`size-[14px] flex-none text-faint transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          tabIndex={-1}
          className={`popover-in absolute z-40 mt-1.5 max-h-[300px] min-w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value}
                data-i={i}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onClick={() => commit(o.value)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                  i === active ? "bg-surface-2" : ""
                } ${isSel ? "font-medium text-ink" : "text-muted"} ${mono ? "font-mono text-[12px]" : ""}`}
              >
                <span className="flex-1 truncate">{o.label}</span>
                {isSel && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="size-[14px] flex-none text-brand">
                    <path d="m5 12 5 5L20 7" />
                  </svg>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Custom dropdown that navigates by setting a URL search param on change. */
export function SelectNav({
  param,
  value,
  options,
  mono = false,
  align = "right",
  ariaLabel,
}: {
  param: string;
  value: string;
  options: Option[];
  mono?: boolean;
  align?: "left" | "right";
  ariaLabel?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <Select
      value={value}
      options={options}
      mono={mono}
      align={align}
      ariaLabel={ariaLabel}
      onChange={(v) => {
        const qs = withParam(params, param, v);
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Custom slider (pointer + keyboard, no native range)                */
/* ------------------------------------------------------------------ */

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  tone = "brand",
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  tone?: "brand" | "ai" | "human";
  ariaLabel?: string;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const pct = ((value - min) / (max - min)) * 100;
  const color = `var(--${tone})`;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const snapped = Math.round(raw / step) * step;
      onChange(Math.min(max, Math.max(min, snapped)));
    },
    [min, max, step, onChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const move = (e: PointerEvent) => setFromClientX(e.clientX);
    const up = () => setDragging(false);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [dragging, setFromClientX]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    let next = value;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = value + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = value - step;
    else if (e.key === "Home") next = min;
    else if (e.key === "End") next = max;
    else if (e.key === "PageUp") next = value + step * 10;
    else if (e.key === "PageDown") next = value - step * 10;
    else return;
    e.preventDefault();
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div
      ref={trackRef}
      onPointerDown={(e) => {
        e.preventDefault();
        setDragging(true);
        setFromClientX(e.clientX);
      }}
      className="relative flex h-5 cursor-pointer items-center touch-none select-none"
    >
      {/* track */}
      <div className="h-1.5 w-full rounded-full bg-line-strong/60" />
      {/* fill */}
      <div
        className="pointer-events-none absolute left-0 h-1.5 rounded-full"
        style={{ width: `${pct}%`, background: color }}
      />
      {/* thumb */}
      <div
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-label={ariaLabel}
        onKeyDown={onKeyDown}
        className={`absolute size-[18px] -translate-x-1/2 rounded-full border-2 border-surface bg-[var(--_c)] outline-none transition-[box-shadow,transform] focus-visible:ring-2 focus-visible:ring-[color:var(--_c)] focus-visible:ring-offset-1 focus-visible:ring-offset-surface ${
          dragging ? "scale-110" : ""
        }`}
        style={
          {
            left: `${pct}%`,
            "--_c": color,
            boxShadow: dragging
              ? `0 0 0 6px color-mix(in oklab, ${color} 18%, transparent)`
              : `0 1px 4px -1px rgba(0,0,0,0.3)`,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
