"use client";

import { useEffect, useState } from "react";
import { MapPin, Search, Star } from "lucide-react";
import { listColleges, type CollegeListing } from "../lib/api";

// Only the streams that actually have colleges in the catalogue.
const STREAMS = ["Medical", "Dental", "Engineering", "Law", "Design"];
const LEVELS = [
  { value: "UG", label: "Undergraduate" },
  { value: "PG", label: "Postgraduate" },
  { value: "", label: "Any level" },
];

type Result = { key: string; items: CollegeListing[]; next: string | null; error: string | null };

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-[13.5px] font-bold transition-all active:scale-[0.97] ${
        active
          ? "border-blue-600 bg-blue-600 text-white shadow-[0_8px_18px_-8px_rgba(33,72,201,.6)]"
          : "border-border bg-surface text-slate-600 hover:border-blue-600/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function CollegeCard({ c }: { c: CollegeListing }) {
  const place = [c.district ?? c.city, c.state].filter(Boolean).join(", ");
  return (
    <li className="flex h-full flex-col rounded-[20px] border border-border bg-surface p-5 shadow-[0_12px_30px_-22px_rgba(16,27,59,.3)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-600/30 hover:shadow-[0_24px_48px_-24px_rgba(33,72,201,.35)]">
      <div className="flex flex-wrap items-center gap-1.5">
        {c.stream && (
          <span className="rounded-full bg-[#eef3ff] px-2.5 py-1 text-[11px] font-extrabold text-blue-600">{c.stream}</span>
        )}
        {c.levels.map((l) => (
          <span key={l} className="rounded-full bg-[#f4f5f7] px-2.5 py-1 text-[11px] font-extrabold text-slate-600">
            {l}
          </span>
        ))}
      </div>
      <h3 className="mt-3 text-[16px] font-extrabold leading-snug text-ink">{c.name}</h3>
      {place && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-slate-600">
          <MapPin size={14} aria-hidden="true" className="shrink-0 text-slate-400" />
          {place}
        </p>
      )}
      {c.rating !== null && c.reviewCount > 0 && (
        <p className="mt-auto flex items-center gap-1 pt-3 text-[13px] font-extrabold text-ink">
          <Star size={15} aria-hidden="true" className="fill-gold-500 text-gold-500" />
          {c.rating.toFixed(1)}
          <span className="font-semibold text-slate-400">
            ({c.reviewCount} {c.reviewCount === 1 ? "review" : "reviews"})
          </span>
        </p>
      )}
    </li>
  );
}

/** Live college search on the public /colleges page: type a name, pick a
 * stream and level, page through the real catalogue. Every list is a fresh
 * request — a result is only shown when its `key` matches the current
 * filters, so a slow response for an old query can never overwrite a newer
 * one (the old request is also aborted). */
export function CollegesExplorer() {
  const [search, setSearch] = useState("");
  const [stream, setStream] = useState("");
  const [level, setLevel] = useState("UG");
  const [res, setRes] = useState<Result | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [retry, setRetry] = useState(0);

  const debounced = useDebounced(search, 300);
  const key = `${debounced}|${stream}|${level}|${retry}`;

  useEffect(() => {
    const ctrl = new AbortController();
    listColleges({ search: debounced, stream, level, signal: ctrl.signal })
      .then((r) => setRes({ key, items: r.data, next: r.nextCursor, error: null }))
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setRes({ key, items: [], next: null, error: "We couldn't load colleges just now." });
      });
    return () => ctrl.abort();
    // `key` already encodes every input above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const loading = res === null || res.key !== key;
  const current = res && res.key === key ? res : null;

  async function loadMore() {
    if (!current?.next) return;
    setLoadingMore(true);
    try {
      const r = await listColleges({ search: debounced, stream, level, cursor: current.next });
      setRes((prev) =>
        prev && prev.key === key ? { ...prev, items: [...prev.items, ...r.data], next: r.nextCursor } : prev,
      );
    } catch {
      setRes((prev) => (prev && prev.key === key ? { ...prev, error: "We couldn't load more colleges." } : prev));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="px-6 py-14">
      <div className="mx-auto max-w-[1100px]">
        <div className="relative">
          <Search
            size={20}
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your college by name…"
            aria-label="Search colleges by name"
            className="w-full rounded-2xl border-[1.5px] border-border bg-surface py-4 pl-12 pr-4 text-[16px] font-semibold text-ink shadow-[0_12px_30px_-22px_rgba(16,27,59,.35)] outline-none transition-colors placeholder:text-slate-400 focus:border-blue-600"
          />
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="Filter by stream">
          <Chip active={stream === ""} onClick={() => setStream("")}>
            All streams
          </Chip>
          {STREAMS.map((s) => (
            <Chip key={s} active={stream === s} onClick={() => setStream(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Filter by level">
          {LEVELS.map((l) => (
            <Chip key={l.label} active={level === l.value} onClick={() => setLevel(l.value)}>
              {l.label}
            </Chip>
          ))}
        </div>

        <div className="mt-8" aria-live="polite">
          {loading && (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Loading colleges">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="h-[150px] animate-pulse rounded-[20px] border border-border bg-surface" />
              ))}
            </ul>
          )}

          {!loading && current?.error && current.items.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="font-bold text-ink">{current.error}</p>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="mt-4 rounded-[10px] bg-blue-600 px-5 py-2.5 text-[14px] font-bold text-white hover:bg-blue-500"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && current && !current.error && current.items.length === 0 && (
            <div className="rounded-2xl border border-border bg-surface p-8 text-center">
              <p className="font-extrabold text-ink">No colleges match that.</p>
              <p className="mt-1 text-[14px] font-semibold text-slate-600">
                Try a shorter name, or a different stream or level.
              </p>
            </div>
          )}

          {!loading && current && current.items.length > 0 && (
            <>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {current.items.map((c) => (
                  <CollegeCard key={c.id} c={c} />
                ))}
              </ul>
              {current.error && (
                <p className="mt-4 text-center text-[13.5px] font-bold text-red-600">{current.error}</p>
              )}
              {current.next && (
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-[12px] border-[1.5px] border-blue-600 px-6 py-3 text-[14.5px] font-bold text-blue-600 transition-all hover:bg-[#eef3ff] active:scale-[0.97] disabled:opacity-60"
                  >
                    {loadingMore ? "Loading…" : "Show more colleges"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
