import { Bell, BadgeCheck, EyeOff, PhoneCall, Search, Home, Compass, Users, MessageCircle, User } from "lucide-react";

/** A purely decorative, CSS-drawn phone showing the shape of the real app
 * (search, a verified mentor card, a chat preview, the bottom tab bar).
 * Everything inside is illustrative sample content — no real people, ratings
 * or numbers, and nothing here should be read as a testimonial. Hidden from
 * assistive tech: the page's own text already says everything it shows. */
export function PhoneMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-[272px] sm:w-[292px]">
      {/* soft glow behind the device */}
      <div className="absolute -inset-8 rounded-full bg-blue-500/35 blur-3xl" />

      {/* floating feature chips — hidden on the narrowest screens so they can't clip */}
      <div className="absolute -left-10 top-16 z-10 hidden sm:flex animate-float items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[12.5px] font-extrabold text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]">
        <BadgeCheck size={18} className="text-blue-600" />
        Verified mentors
      </div>
      <div
        className="absolute -right-12 top-[210px] z-10 hidden sm:flex animate-float items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[12.5px] font-extrabold text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]"
        style={{ animationDelay: "1.6s" }}
      >
        <EyeOff size={18} className="text-gold-600" />
        Chat anonymously
      </div>
      <div
        className="absolute -right-10 bottom-20 z-10 hidden sm:flex animate-float items-center gap-2 rounded-2xl bg-white px-3.5 py-2.5 text-[12.5px] font-extrabold text-ink shadow-[0_18px_40px_-12px_rgba(0,0,0,.55)]"
        style={{ animationDelay: "3.2s" }}
      >
        <PhoneCall size={18} className="text-blue-600" />
        Live audio calls
      </div>

      {/* device */}
      <div className="relative rounded-[44px] bg-[#0a1230] p-[9px] shadow-[0_40px_80px_-24px_rgba(0,0,0,.75)] ring-1 ring-white/20 md:rotate-[2.5deg]">
        <div className="relative flex h-[560px] flex-col overflow-hidden rounded-[36px] bg-page">
          <div className="absolute left-1/2 top-2 z-10 h-[20px] w-[78px] -translate-x-1/2 rounded-full bg-[#0a1230]" />

          {/* app header */}
          <div className="flex items-center justify-between bg-white px-4 pb-3 pt-9">
            <span className="text-[15px] font-extrabold text-navy-deep">Uniscope</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#eef3ff] text-blue-600">
              <Bell size={15} />
            </span>
          </div>

          <div className="flex-1 space-y-3 px-3.5 pt-3.5">
            <div>
              <p className="text-[15px] font-extrabold text-ink">
                Good morning, <span className="text-blue-600">Priya</span>
              </p>
              <p className="text-[11px] font-semibold text-slate-600">What are you looking for today?</p>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-border bg-white px-3 py-2.5 text-[11px] font-semibold text-slate-400">
              <Search size={14} />
              Search colleges, courses, or mentors...
            </div>

            <p className="pt-1 text-[12px] font-extrabold text-ink">Top mentors for you</p>

            {/* mentor card */}
            <div className="rounded-2xl border border-border bg-white p-3 shadow-[0_8px_20px_-14px_rgba(16,27,59,.35)]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br from-blue-600 to-sky-300 text-[13px] font-extrabold text-white">
                  AK
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[13px] font-extrabold text-ink">
                    Aarav K.
                    <BadgeCheck size={14} className="text-blue-600" />
                  </p>
                  <p className="text-[10.5px] font-semibold text-slate-600">MBBS · 3rd year</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9.5px] font-extrabold text-emerald-700">
                  Accepting calls
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <span className="rounded-lg border-[1.5px] border-blue-600 py-1.5 text-center text-[11.5px] font-extrabold text-blue-600">
                  Chat
                </span>
                <span className="rounded-lg bg-blue-600 py-1.5 text-center text-[11.5px] font-extrabold text-white">
                  Call
                </span>
              </div>
            </div>

            {/* chat preview */}
            <div className="space-y-2 pt-1">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-blue-600 px-3 py-2 text-[11px] font-semibold leading-snug text-white">
                How is hostel life for first-years?
              </div>
              <div className="max-w-[84%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-[11px] font-semibold leading-snug text-ink shadow-[0_6px_16px_-12px_rgba(16,27,59,.5)]">
                Rooms are shared and the mess is decent. Ask me anything specific!
              </div>
            </div>
          </div>

          {/* tab bar */}
          <div className="grid grid-cols-5 border-t border-border bg-white px-2 pb-4 pt-2.5 text-slate-400">
            {[
              { Icon: Home, label: "Home", active: true },
              { Icon: Compass, label: "Discover" },
              { Icon: Users, label: "Mentors" },
              { Icon: MessageCircle, label: "Sessions" },
              { Icon: User, label: "Profile" },
            ].map(({ Icon, label, active }) => (
              <span
                key={label}
                className={`flex flex-col items-center gap-0.5 text-[8.5px] font-bold ${active ? "text-blue-600" : ""}`}
              >
                <Icon size={16} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
