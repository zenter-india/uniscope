'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Badge, Button, Card, fieldClass } from '../../../components/ui';
import { toast } from '../../../lib/toast';
import {
  previewPromotion,
  searchPromotionUsers,
  sendPromotion,
  type PickableUser,
  type Promotion,
  type PromotionAudience,
  type PromotionReach,
} from './actions';

const AUDIENCE_OPTIONS: { value: PromotionAudience; label: string }[] = [
  { value: 'ALL', label: 'All users (students + mentors)' },
  { value: 'ASPIRANT', label: 'Students only' },
  { value: 'MENTOR', label: 'Mentors only' },
  { value: 'SELECTED', label: 'Specific users (pick below)' },
];

const AUDIENCE_LABEL: Record<string, string> = {
  ALL: 'All users',
  ASPIRANT: 'Students',
  MENTOR: 'Mentors',
  SELECTED: 'Picked users',
};

const TITLE_MAX = 120;
const BODY_MAX = 500;
const LABEL_MAX = 40;
// Keep in step with the backend limits (create-promotion.dto.ts).
const MAX_SELECTED = 200;
const MAX_UNIMINUTES = 1000;
const MAX_RUPEES = 10000;

const labelClass = 'text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500';
const hintClass = 'text-[11px] text-zinc-400 dark:text-zinc-500';

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const uniminutes = (minor: number) => minor / 1000;
const rupees = (minor: number) => minor / 100;

/** A whole, non-negative number from a text box ('' counts as 0); NaN if it is anything else. */
function wholeNumber(text: string): number {
  const t = text.trim();
  if (t === '') return 0;
  return /^\d+$/.test(t) ? Number(t) : NaN;
}

function creditSummary(p: Promotion): string[] {
  const parts: string[] = [];
  if (p.aspirantCreditMinor > 0) {
    parts.push(`${uniminutes(p.aspirantCreditMinor).toLocaleString()} Uniminutes to each student`);
  }
  if (p.mentorCreditMinor > 0) {
    parts.push(`₹${rupees(p.mentorCreditMinor).toLocaleString()} to each mentor`);
  }
  return parts;
}

/** Search-and-tick list for a promotion sent to specific people. */
function UserPicker({
  picked,
  onChange,
  disabled,
}: {
  picked: PickableUser[];
  onChange: (next: PickableUser[]) => void;
  disabled: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PickableUser[]>([]);
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef('');

  const onQuery = (value: string) => {
    setQuery(value);
    latest.current = value;
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    timer.current = setTimeout(() => {
      searchPromotionUsers(value)
        .then((found) => {
          if (latest.current === value) setResults(found);
        })
        .catch(() => {
          if (latest.current === value) setResults([]);
        })
        .finally(() => {
          if (latest.current === value) setSearching(false);
        });
    }, 300);
  };

  const isPicked = (id: string) => picked.some((u) => u.id === id);
  const toggle = (user: PickableUser) => {
    if (isPicked(user.id)) {
      onChange(picked.filter((u) => u.id !== user.id));
    } else if (picked.length < MAX_SELECTED) {
      onChange([...picked, user]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <input
        className={`${fieldClass} max-w-sm`}
        value={query}
        disabled={disabled}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search by name or ID (2+ letters)"
        aria-label="Search users"
      />

      {query.trim().length >= 2 && (
        <div className="max-w-md rounded-lg border border-zinc-200 dark:border-zinc-800">
          {searching && results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">No matching users.</p>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {results.map((u) => (
                <li key={u.id}>
                  <label
                    className={`flex items-center gap-3 px-3 py-2 text-sm ${
                      u.eligible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isPicked(u.id)}
                      disabled={disabled || (!u.eligible && !isPicked(u.id))}
                      onChange={() => toggle(u)}
                    />
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{u.displayName}</span>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {u.role === 'MENTOR' ? 'Mentor' : 'Student'}
                      {u.uniqueId ? ` · ${u.uniqueId}` : ''}
                      {u.eligible ? '' : ' · banned or inactive'}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {picked.map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 py-0.5 pl-2.5 pr-1 text-xs text-zinc-700 dark:text-zinc-200"
          >
            {u.displayName}
            <button
              type="button"
              disabled={disabled}
              aria-label={`Remove ${u.displayName}`}
              onClick={() => onChange(picked.filter((x) => x.id !== u.id))}
              className="rounded-full px-1.5 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              ×
            </button>
          </span>
        ))}
        <span className={hintClass}>
          {picked.length}/{MAX_SELECTED} picked
        </span>
      </div>
    </div>
  );
}

export function PromotionPanel({ initialHistory }: { initialHistory: Promotion[] }) {
  const [history, setHistory] = useState(initialHistory);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<PromotionAudience>('ALL');
  const [picked, setPicked] = useState<PickableUser[]>([]);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLabel, setLinkLabel] = useState('');
  const [uniminutesText, setUniminutesText] = useState('');
  const [rupeesText, setRupeesText] = useState('');

  const [reach, setReach] = useState<PromotionReach | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pickedKey = picked.map((u) => u.id).join(',');

  // Refresh the "will reach N people" hint when the audience or the picks change.
  useEffect(() => {
    if (audience === 'SELECTED' && pickedKey === '') return;
    let cancelled = false;
    previewPromotion(audience, pickedKey ? pickedKey.split(',') : [])
      .then((r) => {
        if (!cancelled) setReach(r);
      })
      .catch(() => {
        if (!cancelled) setReach(null);
      });
    return () => {
      cancelled = true;
    };
  }, [audience, pickedKey]);

  const showStudentCredit = audience !== 'MENTOR';
  const showMentorCredit = audience !== 'ASPIRANT';

  const uniminutesEach = showStudentCredit ? wholeNumber(uniminutesText) : 0;
  const rupeesEach = showMentorCredit ? wholeNumber(rupeesText) : 0;
  const uniminutesBad = Number.isNaN(uniminutesEach) || uniminutesEach > MAX_UNIMINUTES;
  const rupeesBad = Number.isNaN(rupeesEach) || rupeesEach > MAX_RUPEES;

  const trimmedTitle = title.trim();
  const trimmedLink = linkUrl.trim();
  const linkBad = trimmedLink !== '' && !/^https:\/\/\S+\.\S+$/.test(trimmedLink);
  const noPicks = audience === 'SELECTED' && picked.length === 0;
  const canSend =
    trimmedTitle.length > 0 && !uniminutesBad && !rupeesBad && !linkBad && !noPicks && !isPending;

  const studentsReached = reach?.aspirantCount ?? 0;
  const mentorsReached = reach?.mentorCount ?? 0;
  const totalRupees = rupeesEach * mentorsReached;
  const totalUniminutes = uniminutesEach * studentsReached;
  const hasCredit = uniminutesEach > 0 || rupeesEach > 0;

  const doSend = () => {
    setError(null);
    startTransition(async () => {
      const res = await sendPromotion({
        title: trimmedTitle,
        body: body.trim(),
        audience,
        userIds: picked.map((u) => u.id),
        linkUrl: trimmedLink,
        linkLabel: linkLabel.trim(),
        aspirantUniminutes: uniminutesEach,
        mentorRupees: rupeesEach,
      });
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        setConfirming(false);
        return;
      }
      const p = res.promotion;
      setHistory((prev) => [p, ...prev]);
      let msg = `Sent to ${plural(p.recipientCount, 'person', 'people')}.`;
      if (p.aspirantCreditMinor > 0 || p.mentorCreditMinor > 0) {
        msg += ` Wallets credited: ${p.creditedCount.toLocaleString()}.`;
        if (p.creditedCount < p.recipientCount) {
          msg += ' Some were not credited; check the server log.';
        }
      }
      setSent(msg);
      toast.success(msg);
      setTitle('');
      setBody('');
      setLinkUrl('');
      setLinkLabel('');
      setUniminutesText('');
      setRupeesText('');
      setPicked([]);
      setConfirming(false);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">New promotion</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
          Sends the usual notification and also shows the message as a pop-up the next time each
          person opens the app. It can carry a link and, optionally, add Uniminutes (students) or
          money (mentors) to their wallet. It can&apos;t be recalled once sent.
        </p>

        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Title</span>
            <input
              className={fieldClass}
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 10 free Uniminutes for you"
            />
            <span className={`self-end ${hintClass}`}>
              {title.length}/{TITLE_MAX}
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className={labelClass}>
              Message <span className="normal-case">(optional)</span>
            </span>
            <textarea
              className={fieldClass}
              rows={3}
              value={body}
              maxLength={BODY_MAX}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Shown in the pop-up and the notification."
            />
            <span className={`self-end ${hintClass}`}>
              {body.length}/{BODY_MAX}
            </span>
          </label>

          <div className="flex flex-col gap-1">
            <span className={labelClass}>Audience</span>
            <select
              className={`${fieldClass} max-w-sm`}
              value={audience}
              onChange={(e) => {
                setReach(null);
                setAudience(e.target.value as PromotionAudience);
              }}
              aria-label="Audience"
            >
              {AUDIENCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {noPicks
                ? 'Pick at least one person.'
                : reach === null
                  ? 'Counting recipients…'
                  : `Will reach ${plural(reach.recipientCount, 'person', 'people')} (${plural(
                      reach.aspirantCount,
                      'student',
                      'students',
                    )}, ${plural(reach.mentorCount, 'mentor', 'mentors')}). Banned and deleted accounts are skipped.`}
            </span>
          </div>

          {audience === 'SELECTED' && (
            <UserPicker picked={picked} onChange={setPicked} disabled={isPending} />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>
                Link <span className="normal-case">(optional, https only)</span>
              </span>
              <input
                className={fieldClass}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://uniscope.in/..."
                inputMode="url"
              />
              {linkBad && (
                <span className="text-xs text-red-600 dark:text-red-400">
                  Enter a full link starting with https://
                </span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className={labelClass}>
                Button label <span className="normal-case">(default &ldquo;Open&rdquo;)</span>
              </span>
              <input
                className={fieldClass}
                value={linkLabel}
                maxLength={LABEL_MAX}
                disabled={trimmedLink === ''}
                onChange={(e) => setLinkLabel(e.target.value)}
                placeholder="e.g. Claim offer"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {showStudentCredit && (
              <label className="flex flex-col gap-1">
                <span className={labelClass}>
                  Add Uniminutes to each student <span className="normal-case">(optional)</span>
                </span>
                <input
                  className={fieldClass}
                  value={uniminutesText}
                  inputMode="numeric"
                  onChange={(e) => setUniminutesText(e.target.value)}
                  placeholder="0"
                />
                <span className={uniminutesBad ? 'text-xs text-red-600 dark:text-red-400' : hintClass}>
                  {uniminutesBad
                    ? `Enter a whole number from 0 to ${MAX_UNIMINUTES}.`
                    : `Whole number, up to ${MAX_UNIMINUTES}. 1 Uniminute = 1 minute of call.`}
                </span>
              </label>
            )}
            {showMentorCredit && (
              <label className="flex flex-col gap-1">
                <span className={labelClass}>
                  Add money to each mentor, in ₹ <span className="normal-case">(optional)</span>
                </span>
                <input
                  className={fieldClass}
                  value={rupeesText}
                  inputMode="numeric"
                  onChange={(e) => setRupeesText(e.target.value)}
                  placeholder="0"
                />
                <span className={rupeesBad ? 'text-xs text-red-600 dark:text-red-400' : hintClass}>
                  {rupeesBad
                    ? `Enter a whole number from 0 to ${MAX_RUPEES.toLocaleString()}.`
                    : `Whole rupees, up to ₹${MAX_RUPEES.toLocaleString()}. Mentors can withdraw it.`}
                </span>
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {sent && !error && <p className="text-sm text-emerald-600 dark:text-emerald-400">{sent}</p>}

          {confirming ? (
            <div className="flex flex-col gap-2 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-3">
              <p className="text-sm text-amber-900 dark:text-amber-300">
                Send &ldquo;<span className="font-semibold">{trimmedTitle}</span>&rdquo; to{' '}
                <span className="font-semibold">
                  {reach ? plural(reach.recipientCount, 'person', 'people') : AUDIENCE_LABEL[audience]}
                </span>
                {trimmedLink && (
                  <>
                    {' '}
                    with a &ldquo;{linkLabel.trim() || 'Open'}&rdquo; button to{' '}
                    <span className="break-all font-mono text-xs">{trimmedLink}</span>
                  </>
                )}
                ?
              </p>
              {hasCredit && (
                <ul className="list-disc pl-5 text-sm font-semibold text-amber-900 dark:text-amber-300">
                  {uniminutesEach > 0 && (
                    <li>
                      Adds {uniminutesEach.toLocaleString()} Uniminutes to each of{' '}
                      {plural(studentsReached, 'student', 'students')} (
                      {totalUniminutes.toLocaleString()} in total)
                    </li>
                  )}
                  {rupeesEach > 0 && (
                    <li>
                      Adds ₹{rupeesEach.toLocaleString()} to each of{' '}
                      {plural(mentorsReached, 'mentor', 'mentors')} (₹{totalRupees.toLocaleString()} in
                      total)
                    </li>
                  )}
                </ul>
              )}
              <p className="text-sm text-amber-900 dark:text-amber-300">
                {hasCredit
                  ? 'This moves real money into wallets immediately and can’t be undone.'
                  : 'This notifies everyone immediately and can’t be undone.'}
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="primary" onClick={doSend} disabled={isPending}>
                  {isPending ? 'Sending…' : 'Send now'}
                </Button>
                <Button size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              <Button
                variant="primary"
                onClick={() => {
                  setError(null);
                  setSent(null);
                  setConfirming(true);
                }}
                disabled={!canSend}
              >
                Review &amp; send
              </Button>
            </div>
          )}
        </div>
      </Card>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">Recent promotions</h2>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing sent yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {history.map((p) => {
              const credits = creditSummary(p);
              return (
                <Card key={p.id} className="p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.title}</span>
                    <Badge>{AUDIENCE_LABEL[p.audience] ?? p.audience}</Badge>
                    <span className="text-xs text-zinc-400 dark:text-zinc-500">
                      {p.recipientCount.toLocaleString()} recipients · seen by {p.seenCount.toLocaleString()}
                    </span>
                  </div>
                  {p.body && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{p.body}</p>}
                  {p.linkUrl && (
                    <p className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
                      {p.linkLabel ?? 'Open'}: {p.linkUrl}
                    </p>
                  )}
                  {credits.length > 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                      Credit: {credits.join(' · ')} · credited {p.creditedCount.toLocaleString()} of{' '}
                      {p.recipientCount.toLocaleString()}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
