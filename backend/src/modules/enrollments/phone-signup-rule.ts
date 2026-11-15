/** Shown on the website form (and returned by the server) when a phone number
 * already has an account. A number can only ever be used for one account —
 * for either role, with no exceptions — so every second sign-up on it is
 * refused with this message. */
export const PHONE_TAKEN_MESSAGE =
  'This phone number already has an account. Please use a different number.';
