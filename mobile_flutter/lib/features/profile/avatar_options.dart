/// Shared constants/helpers for the avatar picker — used by both the
/// standalone customizer (Profile → pencil badge) and the onboarding
/// wizards' embedded avatar step, so the two can't drift apart.
library;

enum AvatarGender { male, female }

const Map<AvatarGender, String> genderLabels = {
  AvatarGender.male: 'Male',
  AvatarGender.female: 'Female',
};

/// 'top' is by far the biggest category (23 raw DiceBear values) and the
/// most visually gender-coded one, so it's the one hairstyle category
/// curated per selection (facial hair is too — see [facialHairByGender]).
/// Everything else (clothing, colours) stays gender-independent —
/// narrowing those by gender would be presumptuous where they genuinely
/// aren't gender-coded.
const Map<AvatarGender, List<String>> topsByGender = {
  AvatarGender.male: [
    'shortFlat', 'shortWaved', 'shortCurly', 'shortRound', 'theCaesar',
    'frizzle', 'shaggy', 'turban', 'hat',
  ],
  AvatarGender.female: [
    'bob', 'bun', 'curly', 'curvy', 'straight01', 'straight02',
    'longButNotTooLong', 'bigHair', 'fro', 'froBand', 'hijab',
  ],
};

/// Facial hair only makes sense as a male-coded category here — the female
/// list is just `[null]` (i.e. hidden entirely; see AvatarPickerPanel,
/// which skips rendering this category when the gender is female).
const Map<AvatarGender, List<String?>> facialHairByGender = {
  AvatarGender.male: [null, 'beardLight', 'beardMedium', 'moustacheFancy'],
  AvatarGender.female: [null],
};

/// Human-readable labels for the enum categories — the raw DiceBear values
/// (e.g. 'shortFlat', 'raisedExcitedNatural') aren't fit to show a user.
const Map<String, String> categoryLabels = {
  'top': 'Hair / head',
  'hairColor': 'Hair colour',
  'eyes': 'Eyes',
  'eyebrows': 'Eyebrows',
  'mouth': 'Mouth',
  'facialHair': 'Facial hair',
  'accessories': 'Glasses',
  'clothing': 'Clothing',
  'clothesColor': 'Clothing colour',
  'skinColor': 'Skin tone',
};

const Set<String> colorCategories = {'hairColor', 'clothesColor', 'skinColor'};

/// Curated subsets for the remaining categories — same for every gender,
/// trimmed from the server's full catalogue purely to keep the picker
/// from being overwhelming. `null` (shown as "None") always stays first
/// where the category allows it.
const Map<String, List<dynamic>> curatedOptions = {
  'eyes': ['default', 'happy', 'wink', 'surprised', 'closed'],
  'eyebrows': ['defaultNatural', 'raisedExcitedNatural', 'upDownNatural'],
  'mouth': ['smile', 'default', 'twinkle', 'serious'],
  // 'facialHair' isn't listed here — it's gender-curated, see
  // facialHairByGender above.
  'accessories': [null, 'round', 'wayfarers', 'sunglasses'],
  'clothing': ['shirtCrewNeck', 'hoodie', 'blazerAndShirt', 'graphicShirt', 'overall'],
  'hairColor': ['2c1b18', '4a312c', 'a55728', 'd6b370', 'c93305', 'e8e1e1'],
  'clothesColor': ['12a9a3', '2a72dc', '3c4f5c', 'ff5c5c', '65c9ff', 'a7ffc4'],
  // skinColor intentionally not trimmed — all 6 tones stay, representation
  // matters more there than brevity.
};

/// Per-category overrides for specific raw values whose humanized form
/// ("Default") doesn't actually describe what the option looks like.
const Map<String, Map<String, String>> _valueLabelOverrides = {
  'eyes': {'default': 'Straight'},
  'eyebrows': {
    'defaultNatural': 'Natural',
    'raisedExcitedNatural': 'Raised',
    'upDownNatural': 'Up Down',
  },
  'top': {
    'shortFlat': 'Flat',
    'shortWaved': 'Waved',
    'shortCurly': 'Curly',
    'shortRound': 'Round',
    'theCaesar': 'Caesar',
    'straight01': 'Straight',
    'straight02': 'Long',
    'longButNotTooLong': 'Short',
  },
  'facialHair': {'moustacheFancy': 'Moustache'},
};

AvatarGender genderFromProfile(String? profileGender) {
  return profileGender?.toLowerCase() == 'female'
      ? AvatarGender.female
      : AvatarGender.male;
}

String humanizeAvatarValue(String category, String value) {
  final override = _valueLabelOverrides[category]?[value];
  if (override != null) return override;
  // camelCase -> "Camel Case"; leaves already-plain words untouched.
  final spaced = value.replaceAllMapped(
    RegExp(r'([a-z0-9])([A-Z])'),
    (m) => '${m[1]} ${m[2]}',
  );
  return spaced[0].toUpperCase() + spaced.substring(1);
}
