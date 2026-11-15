/**
 * Buy-Uniminutes client: the same OTP login and wallet endpoints the mobile
 * app uses (POST /auth/otp/*, GET /wallet, POST /wallet/topup[/verify]), called
 * from the browser. The session lives in sessionStorage, so closing the tab
 * signs the person out.
 */
import { ApiError, request } from "./api";

/** 1 Uniminute = ₹10 of wallet balance, in paise (see UNIMINUTE_VALUE_MINOR in
 * backend wallet.service.ts). */
export const MINOR_PER_UNIMINUTE = 1000;

export interface TopupPack {
  /** Price in paise. Must be one of the backend's RECHARGE_PACKAGES amounts —
   * the server rejects any other amount. */
  amountMinor: number;
  uniminutes: number;
  name: string;
  tagline: string;
}

/** The Android/web price list (the iOS prices are higher because Apple takes a
 * cut; they are not used here). */
export const TOPUP_PACKS: readonly TopupPack[] = [
  {
    amountMinor: 25_000,
    uniminutes: 10,
    name: "Sneak Peek",
    tagline: "A focused conversation with a mentor who has lived on campus.",
  },
  {
    amountMinor: 40_000,
    uniminutes: 20,
    name: "Campus Tour",
    tagline: "Curated time to weigh your shortlist with informed, firsthand insight.",
  },
  {
    amountMinor: 75_000,
    uniminutes: 40,
    name: "Deep Dive",
    tagline: "In-depth guidance on placements, academics, and campus culture.",
  },
  {
    amountMinor: 100_000,
    uniminutes: 60,
    name: "Insider Pass",
    tagline: "Our most considered pack, for the decision that shapes your future.",
  },
];

export function formatRupees(amountMinor: number): string {
  return `₹${(amountMinor / 100).toLocaleString("en-IN")}`;
}

export function toUniminutes(amountMinor: number): number {
  return Math.floor(amountMinor / MINOR_PER_UNIMINUTE);
}

// ── session ────────────────────────────────────────────────────────────────

interface Session {
  accessToken: string;
  refreshToken: string;
}

const SESSION_KEY = "uniscope.web.session";

function readSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function writeSession(session: Session | null): void {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage blocked (private mode): the person just logs in again next time.
  }
}

export function hasSession(): boolean {
  return readSession() !== null;
}

export function signOut(): void {
  writeSession(null);
}

// ── login ──────────────────────────────────────────────────────────────────

/** The backend validates Indian numbers and the app sends +91 plus ten digits. */
function toE164(tenDigits: string): string {
  return `+91${tenDigits.replace(/\D/g, "")}`;
}

export function requestOtp(tenDigits: string): Promise<{ serviceId: string }> {
  return request("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify({ phone: toE164(tenDigits) }),
  });
}

export interface LoginResult {
  isNewUser: boolean;
}

export async function verifyOtp(
  tenDigits: string,
  code: string,
  serviceId: string,
): Promise<LoginResult> {
  const res = await request<{
    accessToken: string;
    refreshToken: string;
    user: { isNewUser: boolean };
  }>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify({ phone: toE164(tenDigits), code: code.trim(), serviceId }),
  });
  writeSession({ accessToken: res.accessToken, refreshToken: res.refreshToken });
  return { isNewUser: res.user.isNewUser };
}

// ── authenticated calls ────────────────────────────────────────────────────

async function refreshSession(session: Session): Promise<Session | null> {
  try {
    const next = await request<Session>("/auth/token/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    });
    const fresh = { accessToken: next.accessToken, refreshToken: next.refreshToken };
    writeSession(fresh);
    return fresh;
  } catch {
    writeSession(null);
    return null;
  }
}

/** Calls an endpoint that needs login. An expired access token is refreshed
 * once and the call retried; if that fails the session is cleared and a 401
 * ApiError is thrown so the page can show the login form again. */
async function authed<T>(path: string, init?: RequestInit): Promise<T> {
  let session = readSession();
  if (!session) throw new ApiError("Please log in again.", 401);

  const call = (s: Session) =>
    request<T>(path, {
      ...init,
      headers: { ...init?.headers, Authorization: `Bearer ${s.accessToken}` },
    });

  try {
    return await call(session);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    session = await refreshSession(session);
    if (!session) throw new ApiError("Your session expired. Please log in again.", 401);
    return call(session);
  }
}

export interface Wallet {
  balanceMinor: number;
  reservedMinor: number;
  availableMinor: number;
}

export function getWallet(): Promise<Wallet> {
  return authed<Wallet>("/wallet");
}

export interface TopupOrder {
  orderId: string;
  amountMinor: number;
  currency: string;
  keyId: string;
}

export function createTopup(amountMinor: number): Promise<TopupOrder> {
  return authed<TopupOrder>("/wallet/topup", {
    method: "POST",
    body: JSON.stringify({ amountMinor }),
  });
}

export function verifyTopup(payment: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}): Promise<unknown> {
  return authed("/wallet/topup/verify", {
    method: "POST",
    body: JSON.stringify(payment),
  });
}
