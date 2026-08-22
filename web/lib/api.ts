/**
 * Thin fetch wrapper for the two public surfaces this site calls:
 * GET /universities (the mentor form's college search) and
 * POST /enrollments/{aspirant,mentor} (both forms' submission). Both are
 * unauthenticated by design — see backend/src/modules/enrollments.
 */

// Falls back to the real production backend, not localhost — this value
// gets inlined into the client bundle at build time, and the Vercel deploy
// path here doesn't set NEXT_PUBLIC_API_URL, so a fallback of "localhost"
// would silently ship a broken production build. Local dev overrides this
// via web/.env.local (see .env.example), which still points at localhost.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://uniscope-production.up.railway.app/api/v1";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message =
      (Array.isArray(body?.message) ? body.message.join(", ") : body?.message) ??
      `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }

  return res.json();
}

export interface University {
  id: string;
  name: string;
  state: string;
  city: string | null;
}

export function searchUniversities(query: string): Promise<{ data: University[] }> {
  const params = new URLSearchParams({ limit: "8" });
  if (query.trim()) params.set("search", query.trim());
  return request(`/universities?${params.toString()}`);
}

export interface CuratedCollege {
  id: string;
  label: string;
  specializations: string[];
}

/** Mentor form's curated College/University dropdown for a given
 * stream+degree (currently only Medical/DNB has data). */
export function fetchCuratedColleges(stream: string, degree: string): Promise<CuratedCollege[]> {
  const params = new URLSearchParams({ stream, degree });
  return request(`/universities/curated?${params.toString()}`);
}

export interface LeadAcknowledgement {
  id: string;
  role: "ASPIRANT" | "MENTOR";
  status: string;
}

export function submitAspirantLead(
  payload: Record<string, unknown>,
): Promise<LeadAcknowledgement> {
  return request("/enrollments/aspirant", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function submitMentorLead(
  payload: Record<string, unknown>,
): Promise<LeadAcknowledgement> {
  return request("/enrollments/mentor", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Reads a File into the raw-base64 string the backend's documentBase64
 * field expects (no `data:` URI prefix). */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}
