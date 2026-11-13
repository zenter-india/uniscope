'use client';

import { createContext, useContext } from 'react';
import { FULL_ACCESS, type Access } from '../lib/permissions';

const AccessContext = createContext<Access>(FULL_ACCESS);

/** Gives the dashboard's client components (the side menu) the signed-in
 * admin's access, looked up on the server. */
export function AccessProvider({ access, children }: { access: Access; children: React.ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export function useAccess(): Access {
  return useContext(AccessContext);
}
