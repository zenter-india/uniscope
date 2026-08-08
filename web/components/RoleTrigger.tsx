"use client";

/** Every "Log in" / "Sign up" / "Explore Colleges" / "Talk to Mentors" button
 * on the page. This is a forms-only microsite — none of those destinations
 * exist yet — so every one of them scrolls to #get-started and pre-selects
 * the matching role, rather than dead-ending. GetStarted listens for the
 * "uniscope:pick-role" event this dispatches; a DOM event (rather than
 * React context) because these triggers live in server-rendered sections
 * (nav, both heroes, closing CTA) with no shared client-component ancestor
 * to thread state through. */
export function RoleTrigger({
  role,
  className,
  children,
}: {
  role: "student" | "mentor";
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
        window.dispatchEvent(new CustomEvent("uniscope:pick-role", { detail: role }));
      }}
    >
      {children}
    </a>
  );
}
