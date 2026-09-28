import { StoreButton } from "./StoreButton";
import { APP_STORE_URL, PLAY_STORE_URL } from "../lib/app-links";

/** The two store buttons together. Centered until `leftFrom`, then
 * left-aligned — the /download hero switches to two columns at `lg`, the
 * closing band at `md`. "never" keeps them centred at every width (home hero). */
export function Stores({ leftFrom }: { leftFrom: "md" | "lg" | "never" }) {
  return (
    <div
      className={`flex flex-col items-center gap-3.5 sm:flex-row sm:flex-wrap sm:justify-center ${
        leftFrom === "lg" ? "lg:justify-start" : leftFrom === "md" ? "md:justify-start" : ""
      }`}
    >
      <StoreButton store="ios" href={APP_STORE_URL} />
      <StoreButton store="android" href={PLAY_STORE_URL} />
    </div>
  );
}
