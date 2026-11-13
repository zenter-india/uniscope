import { headers } from 'next/headers';
import { getAccess } from './access';
import { BackendApiError } from './backend';
import { sectionForPath } from './permissions';

/** Stops an admin from changing data in a section they only have View on.
 * Called for every write the panel sends to the backend. The section comes
 * from the page the request was made from (set by the middleware). */
export async function assertCanEditHere(): Promise<void> {
  const pathname = (await headers()).get('x-pathname');
  if (!pathname) return;
  const access = await getAccess();
  if (access.fullAccess) return;
  const section = sectionForPath(pathname);
  if (section && access.permissions.includes(`${section.key}:edit`)) return;
  throw new BackendApiError(
    403,
    `You don't have permission to make changes in ${section?.label ?? 'this section'}. Ask an admin who manages the Admins page.`,
  );
}
