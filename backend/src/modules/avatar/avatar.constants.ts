/**
 * The avatar option catalogue exposed to clients.
 *
 * Deliberately a curated subset of what DiceBear's `avataaars` style
 * supports, not the raw enums: several of the library's expressions
 * (crying, dizzy, vomiting) are wrong for a product where an anxious
 * 18-year-old is choosing how they present themselves to a stranger.
 *
 * Hijab and turban are kept in the hair list on purpose — this is an
 * Indian-market product and those are ordinary, not edge cases.
 */

export const AVATAR_TOPS = [
  'shortFlat', 'shortWaved', 'shortCurly', 'shortRound', 'theCaesar',
  'sides', 'shavedSides', 'dreads01', 'frizzle', 'shaggy',
  'bob', 'bun', 'curly', 'curvy', 'straight01', 'straight02',
  'longButNotTooLong', 'bigHair', 'fro', 'froBand',
  'hijab', 'turban', 'hat',
] as const;

export const AVATAR_EYES = [
  'default', 'happy', 'squint', 'wink', 'side', 'surprised', 'closed', 'hearts',
] as const;

export const AVATAR_EYEBROWS = [
  'defaultNatural', 'flatNatural', 'raisedExcitedNatural', 'upDownNatural',
  'default', 'raisedExcited', 'upDown',
] as const;

export const AVATAR_MOUTHS = [
  'smile', 'default', 'twinkle', 'serious', 'tongue', 'grimace', 'eating',
] as const;

/** `null` means clean-shaven — rendered by setting facialHairProbability to 0. */
export const AVATAR_FACIAL_HAIR = [
  null, 'beardLight', 'beardMedium', 'beardMajestic',
  'moustacheFancy', 'moustacheMagnum',
] as const;

/** `null` means no glasses. */
export const AVATAR_ACCESSORIES = [
  null, 'round', 'prescription01', 'prescription02', 'wayfarers', 'sunglasses',
] as const;

export const AVATAR_CLOTHING = [
  'shirtCrewNeck', 'shirtVNeck', 'shirtScoopNeck', 'hoodie', 'collarAndSweater',
  'blazerAndShirt', 'blazerAndSweater', 'graphicShirt', 'overall',
] as const;

// Hex without the leading '#', which is the format DiceBear expects.
export const AVATAR_SKIN_COLORS = [
  'edb98a', 'ffdbb4', 'd08b5b', 'ae5d29', '614335', 'f8d25c',
] as const;

export const AVATAR_HAIR_COLORS = [
  '2c1b18', '4a312c', '724133', 'a55728', 'b58143', 'd6b370',
  'c93305', 'e8e1e1',
] as const;

/** Leads with the brand teal and blue so a default avatar looks in-family. */
export const AVATAR_CLOTHES_COLORS = [
  '12a9a3', '2a72dc', '3c4f5c', '929598', 'ff5c5c', 'ffafb9',
  'ffffb1', '25557c', '65c9ff', 'a7ffc4',
] as const;

export type AvatarConfig = {
  top: string;
  hairColor: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  facialHair: string | null;
  accessories: string | null;
  clothing: string;
  clothesColor: string;
  skinColor: string;
};

/** Shape the mobile picker renders itself from, so the client never
 * hardcodes a list that could drift from what the server will accept. */
export const AVATAR_OPTION_CATALOG = {
  top: AVATAR_TOPS,
  hairColor: AVATAR_HAIR_COLORS,
  eyes: AVATAR_EYES,
  eyebrows: AVATAR_EYEBROWS,
  mouth: AVATAR_MOUTHS,
  facialHair: AVATAR_FACIAL_HAIR,
  accessories: AVATAR_ACCESSORIES,
  clothing: AVATAR_CLOTHING,
  clothesColor: AVATAR_CLOTHES_COLORS,
  skinColor: AVATAR_SKIN_COLORS,
} as const;
