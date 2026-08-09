"use client";

import { useEffect, useRef, useState } from "react";

/** Fades + slides a section in the first time it scrolls into view, once,
 * via IntersectionObserver — not on every re-render and never re-triggered
 * on scroll-back-up, so it reads as a one-time reveal rather than a
 * distracting repeat animation. `motion-safe:` keeps it a no-op entirely
 * under prefers-reduced-motion (children render at full opacity from the
 * start) rather than just shortening the duration. */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-safe:transition-all motion-safe:duration-700 motion-safe:ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
      } ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
