import type { NextFunction, Request, Response } from 'express';

/**
 * Refuses request bodies that claim `Content-Encoding: br`.
 *
 * Why: Node.js's bundled Brotli decoder had an out-of-bounds write
 * (CVE-2026-111497, "Node2Shell"). Express 5's body parser decodes Brotli
 * request bodies by default, so anyone could feed the decoder a crafted
 * stream. Our own clients (the Flutter app, the website, the admin panel)
 * never compress request bodies with Brotli, so rejecting it costs nothing
 * and removes the exposure even on a Node build that is not yet patched.
 *
 * Must be registered before the body parser (see main.ts). Gzip and plain
 * bodies are untouched. The value is a comma-separated list per the HTTP
 * spec, so every listed coding is checked, not just the first.
 */
export function rejectBrotliRequestBodies(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers['content-encoding'];
  if (header) {
    const codings = header
      .split(',')
      .map((coding) => coding.trim().toLowerCase());
    if (codings.includes('br')) {
      res.status(415).json({
        statusCode: 415,
        message: 'Brotli request bodies are not supported.',
      });
      return;
    }
  }
  next();
}
