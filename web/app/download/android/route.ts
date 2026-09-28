import { PLAY_STORE_URL } from "../../../lib/app-links";

/** Target of the Android QR code (see components/DownloadQr.tsx). Sends the phone
 * to the Google Play listing once its URL is set in lib/app-links.ts, and to the
 * general /download page until then — so a printed QR code keeps working and
 * never needs regenerating when the store listing goes live. */
export function GET(request: Request) {
  return Response.redirect(new URL(PLAY_STORE_URL || "/download", request.url), 307);
}
