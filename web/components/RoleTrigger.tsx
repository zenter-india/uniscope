"use client";

/** Every "Explore Colleges" / "Talk to Mentors" (and formerly nav) button on
 * the page. This is a forms-only microsite — none of those destinations
 * exist yet — so every one of them scrolls to #get-started. Passing a `role`
 * also pre-selects that role's form; omit it to just land on the role picker
 * and let the person choose — that's what the plain top-nav links (Explore,
 * Mentors, Colleges, Log in, Sign up) do, since jumping straight into a form
 * from a generic nav click assumes an intent the click didn't actually state.
 * GetStarted listens for the "uniscope:pick-role" event this dispatches; a
 * DOM event (rather than React context) because these triggers live in
 * server-rendered sections (nav, both heroes, closing CTA) with no shared
 * client-component ancestor to thread state through. */
export function RoleTrigger({
  role,
  className,
  children,
}: {
  role?: "student" | "mentor";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href="#get-started"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        document.getElementById("get-started")?.scrollIntoView({ behavior: "smooth" });
        if (role) window.dispatchEvent(new CustomEvent("uniscope:pick-role", { detail: role }));
      }}
    >
      {children}
    </a>
  );
}
