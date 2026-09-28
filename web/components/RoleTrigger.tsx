"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/** sessionStorage key used to carry a chosen role across the navigation from
 * a page that has no sign-up section (Explore / Mentors / Colleges / the
 * legal pages) to the home page's #get-started section. */
export const PENDING_ROLE_KEY = "uniscope:pending-role";

/** Every "Explore Colleges" / "Talk to Mentors" / "Log in" / "Sign up" button
 * on the site. The sign-up forms live in one section (`#get-started`, on the
 * home page and on /download), so every one of these gets the visitor there:
 * by scrolling when the section is on the current page, or by navigating to
 * the home page's section when it isn't (the menu pages, the legal pages).
 * Passing a `role` also pre-selects that role's form; omit it to just land on
 * the role picker and let the person choose — that's what the plain top-nav
 * buttons (Log in, Sign up) do, since jumping straight into a form from a
 * generic click assumes an intent the click didn't actually state.
 * GetStarted listens for the "uniscope:pick-role" event this dispatches; a
 * DOM event (rather than React context) because these triggers live in
 * server-rendered sections (nav, heroes, closing CTA) with no shared
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
  const router = useRouter();

  return (
    <Link
      href="/#get-started"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        const section = document.getElementById("get-started");

        if (!section) {
          try {
            if (role) sessionStorage.setItem(PENDING_ROLE_KEY, role);
            else sessionStorage.removeItem(PENDING_ROLE_KEY);
          } catch {
            // Storage blocked (private mode etc.): fall back to the role picker.
          }
          router.push("/#get-started");
          return;
        }

        section.scrollIntoView({ behavior: "smooth" });
        // Always tell GetStarted, even with no role: a plain link means "let me
        // choose", so if a form is already open it has to bring the picker back
        // (`null`). Only dispatching when a role was passed left every plain nav
        // button looking dead once someone had picked student or mentor.
        window.dispatchEvent(new CustomEvent("uniscope:pick-role", { detail: role ?? null }));
      }}
    >
      {children}
    </Link>
  );
}
