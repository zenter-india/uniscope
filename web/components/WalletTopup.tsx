"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ApiError } from "../lib/api";
import {
  TOPUP_PACKS,
  createTopup,
  formatRupees,
  getMyRole,
  getWallet,
  hasSession,
  requestOtp,
  signOut,
  toUniminutes,
  verifyOtp,
  verifyTopup,
  type TopupPack,
  type Wallet,
} from "../lib/wallet";
import { CheckoutDismissed, openCheckout } from "../lib/razorpay";

type Step = "loading" | "phone" | "otp" | "packs" | "mentor";

const INPUT_CLASS =
  "w-full rounded-[11px] border border-border bg-white px-3.5 py-3 text-[15px] text-ink placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500";
const PRIMARY_BUTTON =
  "rounded-[11px] bg-blue-600 text-white font-bold text-[14.5px] px-5 py-3 disabled:opacity-60 shadow-[0_8px_20px_-8px_rgba(33,72,201,.55)] hover:bg-blue-500 active:scale-[0.97] transition";
const LINK_BUTTON = "text-[13.5px] font-bold text-blue-600 hover:underline disabled:opacity-60";

const SUPPORT_EMAIL = "support@uniscope.in";
const WALLET_POLL_ATTEMPTS = 6;
const WALLET_POLL_MS = 3000;

function messageOf(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function WalletTopup() {
  const [step, setStep] = useState<Step>("loading");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testMode, setTestMode] = useState(false);

  /** Loads the balance and shows the packs; a lapsed login goes back to the
   * phone step. A mentor gets a notice instead: wallet top-up is for
   * aspirants only (the backend refuses a mentor's top-up as well). */
  const showWallet = useCallback(async () => {
    try {
      if ((await getMyRole()) === "MENTOR") {
        setWallet(null);
        setStep("mentor");
        return;
      }
      setWallet(await getWallet());
      setStep("packs");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        signOut();
        setStep("phone");
        return;
      }
      setStep("phone");
      setError(messageOf(err, "Could not load your wallet. Please try again."));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!hasSession()) {
        if (!cancelled) setStep("phone");
        return;
      }
      if (!cancelled) await showWallet();
    })();
    return () => {
      cancelled = true;
    };
  }, [showWallet]);

  async function sendOtp() {
    setError("");
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Enter your 10-digit mobile number.");
      return;
    }
    setBusy(true);
    try {
      const res = await requestOtp(phone);
      setServiceId(res.serviceId);
      setCode("");
      setStep("otp");
    } catch (err) {
      setError(messageOf(err, "Could not send the code. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  async function submitCode() {
    setError("");
    if (!/^\d{4,8}$/.test(code.trim())) {
      setError("Enter the code we sent you.");
      return;
    }
    setBusy(true);
    try {
      const result = await verifyOtp(phone, code, serviceId);
      setIsNewUser(result.isNewUser);
      await showWallet();
    } catch (err) {
      setError(messageOf(err, "That code did not work. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  /** The payment went through but our confirmation call failed. Razorpay also
   * tells the backend directly, so the wallet should still be credited: watch
   * the balance for a short while before asking the person to contact us. */
  async function waitForCredit(balanceBefore: number, paymentId: string) {
    for (let i = 0; i < WALLET_POLL_ATTEMPTS; i++) {
      await sleep(WALLET_POLL_MS);
      try {
        const latest = await getWallet();
        if (latest.balanceMinor > balanceBefore) {
          setWallet(latest);
          setNotice("Payment received. Your Uniminutes have been added.");
          return;
        }
      } catch {
        // keep trying
      }
    }
    setNotice(
      `We received your payment but your Uniminutes have not shown up yet. They are usually added within a minute. ` +
        `If they are not there soon, email ${SUPPORT_EMAIL} with this payment reference: ${paymentId}`,
    );
  }

  async function buy(pack: TopupPack) {
    if (busy) return;
    setError("");
    setNotice("");
    setBusy(true);
    setBuying(pack.amountMinor);
    const balanceBefore = wallet?.balanceMinor ?? 0;
    try {
      const order = await createTopup(pack.amountMinor);
      setTestMode(order.keyId.startsWith("rzp_test_"));

      const payment = await openCheckout({
        keyId: order.keyId,
        orderId: order.orderId,
        amountMinor: order.amountMinor,
        currency: order.currency,
        description: `${pack.name}: ${pack.uniminutes} Uniminutes`,
        contact: phone ? `+91${phone}` : undefined,
      });

      try {
        await verifyTopup({
          razorpayOrderId: payment.razorpay_order_id,
          razorpayPaymentId: payment.razorpay_payment_id,
          razorpaySignature: payment.razorpay_signature,
        });
        setWallet(await getWallet());
        setNotice(`Payment received. ${pack.uniminutes} Uniminutes have been added to your wallet.`);
      } catch {
        setNotice("Payment received. Adding your Uniminutes…");
        await waitForCredit(balanceBefore, payment.razorpay_payment_id);
      }
    } catch (err) {
      if (err instanceof CheckoutDismissed) {
        setNotice("Payment cancelled. You were not charged.");
      } else if (err instanceof ApiError && err.status === 401) {
        signOut();
        setStep("phone");
        setError("Your session expired. Please log in again.");
      } else {
        setError(messageOf(err, "Something went wrong. You were not charged. Please try again."));
      }
    } finally {
      setBusy(false);
      setBuying(null);
    }
  }

  function logOut() {
    signOut();
    setWallet(null);
    setPhone("");
    setCode("");
    setNotice("");
    setError("");
    setIsNewUser(false);
    setStep("phone");
  }

  if (step === "loading") {
    return <p className="text-[14px] font-semibold text-slate-400">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-[11px] bg-red-50 px-4 py-3 text-[13.5px] font-semibold text-red-700">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-[11px] bg-emerald-50 px-4 py-3 text-[13.5px] font-semibold text-emerald-800">
          {notice}
        </p>
      )}

      {step === "phone" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendOtp();
          }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 space-y-4"
        >
          <div>
            <label htmlFor="wallet-phone" className="block text-[13.5px] font-bold text-ink">
              Mobile number
            </label>
            <p className="mt-0.5 text-[12.5px] text-slate-400">
              Use the number you sign in with in the Uniscope app.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="rounded-[11px] border border-border bg-slate-50 px-3 py-3 text-[15px] font-semibold text-slate-600">
                +91
              </span>
              <input
                id="wallet-phone"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="10-digit number"
                className={INPUT_CLASS}
              />
            </div>
          </div>
          <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
            {busy ? "Sending…" : "Send code"}
          </button>
        </form>
      )}

      {step === "otp" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submitCode();
          }}
          className="rounded-2xl border border-border bg-white p-5 sm:p-6 space-y-4"
        >
          <div>
            <label htmlFor="wallet-code" className="block text-[13.5px] font-bold text-ink">
              Enter the code sent to +91 {phone}
            </label>
            <input
              id="wallet-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="Code"
              className={`${INPUT_CLASS} mt-2 max-w-[220px] tracking-widest`}
            />
          </div>
          <div className="flex items-center gap-4">
            <button type="submit" disabled={busy} className={PRIMARY_BUTTON}>
              {busy ? "Checking…" : "Verify"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError("");
                setStep("phone");
              }}
              className={LINK_BUTTON}
            >
              Change number
            </button>
            <button type="button" disabled={busy} onClick={() => void sendOtp()} className={LINK_BUTTON}>
              Resend code
            </button>
          </div>
        </form>
      )}

      {step === "mentor" && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6 flex items-start justify-between gap-4"
        >
          <div>
            <p className="text-[16px] font-extrabold text-amber-900">
              Wallet top-up is not available for mentors.
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-amber-800">
              Top-up is only for aspirants. As a mentor you earn from your calls, and you can see your
              earnings and request a payout from the Wallet tab in the Uniscope app.
            </p>
          </div>
          <button type="button" onClick={logOut} className={`${LINK_BUTTON} shrink-0 whitespace-nowrap`}>
            Log out
          </button>
        </div>
      )}

      {step === "packs" && wallet && (
        <>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-white p-5 sm:p-6">
            <div>
              <p className="text-[12.5px] font-bold uppercase tracking-wide text-slate-400">Your balance</p>
              <p className="mt-1 text-[28px] font-extrabold text-ink">
                {toUniminutes(wallet.availableMinor)} <span className="text-[16px] font-bold">Uniminutes</span>
              </p>
            </div>
            <button type="button" onClick={logOut} disabled={busy} className={LINK_BUTTON}>
              Log out
            </button>
          </div>

          {isNewUser && (
            <p className="rounded-[11px] bg-blue-50 px-4 py-3 text-[13.5px] font-semibold text-blue-800">
              This number is new to Uniscope. Your wallet is ready: download the app and sign in with the same
              number to finish setting up your profile.
            </p>
          )}

          {testMode && (
            <p className="rounded-[11px] bg-amber-50 px-4 py-3 text-[13.5px] font-semibold text-amber-800">
              Test payment: this is a test environment, so no real money moves.
            </p>
          )}

          <ul className="grid gap-4 sm:grid-cols-2">
            {TOPUP_PACKS.map((pack) => (
              <li key={pack.amountMinor} className="rounded-2xl border border-border bg-white p-5 flex flex-col">
                <p className="text-[16px] font-extrabold text-ink">{pack.name}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-slate-600 flex-1">{pack.tagline}</p>
                <p className="mt-4 text-[22px] font-extrabold text-ink">
                  {pack.uniminutes} <span className="text-[14px] font-bold">Uniminutes</span>
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void buy(pack)}
                  className={`${PRIMARY_BUTTON} mt-3`}
                >
                  {buying === pack.amountMinor ? "Opening payment…" : `Pay ${formatRupees(pack.amountMinor)}`}
                </button>
              </li>
            ))}
          </ul>

          <p className="text-[12.5px] leading-relaxed text-slate-400">
            By paying you agree to the{" "}
            <Link href="/terms" className="underline hover:text-slate-600">
              Terms and Conditions
            </Link>{" "}
            and the{" "}
            <Link href="/refund" className="underline hover:text-slate-600">
              Refund and Cancellation Policy
            </Link>
            . Payments are processed securely by Razorpay.
          </p>
        </>
      )}
    </div>
  );
}
