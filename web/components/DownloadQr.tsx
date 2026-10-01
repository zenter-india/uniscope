/** Static QR codes for the two store redirects (generated once, not at runtime —
 * no QR dependency shipped to the browser):
 *   iPhone  -> https://uniscope.in/download/ios
 *   Android -> https://uniscope.in/download/android
 * Each address redirects to that store's listing once its URL is set in
 * lib/app-links.ts (and to /download until then), so a printed or scanned code
 * never needs regenerating when a store listing goes live. Regenerate only if
 * those URLs ever change:
 *   npx qrcode -t svg -e M --margin 0 "https://uniscope.in/download/ios"
 * (the 4-module quiet zone is already baked into the path coordinates). */
const PATHS = {
  ios: "M4 4.5h7m2 0h3m1 0h1m2 0h1m2 0h1m2 0h7M4 5.5h1m5 0h1m1 0h1m3 0h1m1 0h3m1 0h3m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m2 0h1m2 0h3m1 0h1m2 0h1m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m2 0h3m1 0h3m2 0h1m3 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m1 0h1m2 0h1m2 0h3m2 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m2 0h1m1 0h1m1 0h1m4 0h2m2 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M13 11.5h2m1 0h3m1 0h2m1 0h2M4 12.5h1m1 0h1m1 0h1m1 0h1m5 0h1m1 0h2m1 0h1m2 0h1m3 0h1m2 0h1M4 13.5h6m2 0h1m2 0h2m1 0h2m4 0h3m2 0h1m2 0h1M7 14.5h1m1 0h3m1 0h3m1 0h1m8 0h2m2 0h3M4 15.5h2m1 0h1m1 0h1m4 0h1m4 0h1m1 0h1m2 0h1m1 0h2m3 0h1M4 16.5h2m1 0h4m1 0h2m6 0h2m1 0h5m1 0h1m1 0h2M4 17.5h2m1 0h1m1 0h1m1 0h4m2 0h1m1 0h2m4 0h2m2 0h1m2 0h1M4 18.5h1m1 0h2m1 0h2m1 0h1m1 0h1m3 0h4m2 0h2m1 0h3m1 0h2M5 19.5h1m1 0h1m1 0h1m1 0h1m1 0h1m3 0h2m1 0h3m1 0h1m1 0h4m1 0h1M5 20.5h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h1m1 0h4m1 0h4m2 0h1m1 0h2M6 21.5h2m1 0h1m1 0h2m5 0h2m1 0h1m2 0h1m1 0h1m2 0h2m1 0h1M4 22.5h1m1 0h2m2 0h2m1 0h1m1 0h1m1 0h1m4 0h1m3 0h1m4 0h2M5 23.5h1m1 0h1m6 0h3m4 0h3m1 0h1m2 0h2m1 0h1M4 24.5h1m3 0h1m1 0h4m2 0h1m4 0h1m1 0h6M12 25.5h2m3 0h1m2 0h2m1 0h2m3 0h1m1 0h3M4 26.5h7m2 0h2m3 0h1m4 0h2m1 0h1m1 0h2m1 0h2M4 27.5h1m5 0h1m2 0h1m2 0h3m1 0h2m2 0h1m3 0h2m1 0h1M4 28.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h5m1 0h5m3 0h1M4 29.5h1m1 0h3m1 0h1m2 0h1m2 0h1m1 0h1m1 0h1m2 0h2m2 0h2m1 0h3M4 30.5h1m1 0h3m1 0h1m1 0h1m1 0h1m2 0h1m3 0h1m1 0h1m3 0h3m2 0h1M4 31.5h1m5 0h1m4 0h3m1 0h1m1 0h4m6 0h1M4 32.5h7m1 0h4m2 0h4m2 0h6m1 0h2",
  android: "M4 4.5h7m2 0h2m1 0h3m1 0h1m2 0h1m2 0h7M4 5.5h1m5 0h1m1 0h5m1 0h2m2 0h3m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m2 0h1m1 0h4m4 0h1m2 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m4 0h5m2 0h1m3 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m4 0h2m1 0h3m2 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m6 0h1m1 0h2m1 0h2m2 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M14 11.5h1m1 0h4m1 0h1m1 0h2M4 12.5h1m1 0h1m1 0h1m1 0h1m4 0h2m1 0h4m2 0h1m3 0h1m2 0h1M4 13.5h1m1 0h1m7 0h2m2 0h1m1 0h1m3 0h3m2 0h1m2 0h1M4 14.5h1m1 0h7m3 0h2m8 0h2m2 0h3M4 15.5h1m1 0h2m3 0h4m5 0h2m2 0h1m1 0h2m3 0h1M5 16.5h1m3 0h3m2 0h2m3 0h3m1 0h5m1 0h1m1 0h2M4 17.5h2m9 0h3m2 0h1m4 0h2m2 0h1m2 0h1M4 18.5h1m1 0h5m1 0h2m1 0h1m2 0h1m1 0h2m2 0h2m1 0h3m1 0h2M6 19.5h2m1 0h1m6 0h3m2 0h2m1 0h1m1 0h4m1 0h1M4 20.5h3m1 0h4m1 0h1m1 0h2m1 0h1m2 0h1m1 0h4m2 0h1m1 0h2M7 21.5h2m2 0h1m2 0h1m3 0h1m1 0h2m2 0h1m1 0h1m2 0h2m1 0h1M4 22.5h1m2 0h1m2 0h1m2 0h1m3 0h1m2 0h1m1 0h1m3 0h1m4 0h2M5 23.5h4m2 0h2m3 0h1m2 0h5m1 0h1m2 0h2m1 0h1M4 24.5h1m1 0h1m3 0h2m2 0h1m1 0h1m3 0h2m1 0h6M12 25.5h1m1 0h1m2 0h1m2 0h2m1 0h2m3 0h1m1 0h3M4 26.5h7m3 0h3m1 0h1m1 0h1m2 0h2m1 0h1m1 0h2m1 0h2M4 27.5h1m5 0h1m4 0h1m1 0h2m1 0h2m2 0h1m3 0h2m1 0h1M4 28.5h1m1 0h3m1 0h1m1 0h3m3 0h5m1 0h5m2 0h2M4 29.5h1m1 0h3m1 0h1m3 0h1m3 0h1m1 0h1m2 0h2m2 0h2m1 0h3M4 30.5h1m1 0h3m1 0h1m1 0h1m2 0h1m2 0h1m2 0h1m1 0h1m3 0h3m2 0h1M4 31.5h1m5 0h1m2 0h2m2 0h1m1 0h1m1 0h4m6 0h1M4 32.5h7m1 0h2m4 0h1m1 0h2m2 0h6m1 0h2",
} as const;

const LABELS = {
  ios: "QR code for the iPhone app — opens uniscope.in/download/ios",
  android: "QR code for the Android app — opens uniscope.in/download/android",
} as const;

export function DownloadQr({ platform, className }: { platform: "ios" | "android"; className?: string }) {
  return (
    <svg
      viewBox="0 0 37 37"
      role="img"
      aria-label={LABELS[platform]}
      shapeRendering="crispEdges"
      className={className}
    >
      <path fill="#ffffff" d="M0 0h37v37H0z" />
      <path stroke="#071539" d={PATHS[platform]} />
    </svg>
  );
}
