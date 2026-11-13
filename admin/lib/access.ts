import { cache } from 'react';
import { getAdminEmail } from './adminAuth';
import { lookupAccess } from './access-core';
import { NO_ACCESS, type Access } from './permissions';

/** The signed-in admin's access, looked up once per request. */
export const getAccess = cache(async (): Promise<Access> => {
  const email = await getAdminEmail();
  if (!email) return NO_ACCESS;
  return (await lookupAccess(email)) ?? NO_ACCESS;
});
