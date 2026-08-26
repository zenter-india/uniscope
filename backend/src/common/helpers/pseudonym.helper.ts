// Superhero-*flavoured* pseudonyms — deliberately generic archetype words
// rather than any actual Marvel/DC/franchise character name, so the app
// never implies affiliation with or uses trademarked IP.
const POWER_WORDS = [
  'Crimson', 'Shadow', 'Steel', 'Storm', 'Frost', 'Midnight', 'Golden',
  'Obsidian', 'Radiant', 'Cosmic', 'Thunder', 'Solar', 'Lunar', 'Emerald',
  'Onyx', 'Astral', 'Blazing', 'Silver', 'Phantom', 'Titanium',
  'Scarlet', 'Violet', 'Azure', 'Granite', 'Ember', 'Glacial', 'Volt',
  'Neon', 'Ivory', 'Sapphire', 'Ruby', 'Jade', 'Amber', 'Diamond',
  'Platinum', 'Vermillion', 'Indigo', 'Prism', 'Nova', 'Crystal',
];

const HERO_ARCHETYPES = [
  'Vigilante', 'Titan', 'Guardian', 'Sentinel', 'Ranger', 'Warrior',
  'Champion', 'Defender', 'Knight', 'Protector', 'Marksman', 'Striker',
  'Specter', 'Paladin', 'Crusader', 'Hunter', 'Blade', 'Comet',
  'Vanguard', 'Nomad', 'Outlaw', 'Marshal', 'Enforcer', 'Watcher',
  'Raptor', 'Wraith', 'Reaper', 'Warden', 'Emissary', 'Envoy', 'Cipher',
  'Nemesis', 'Marauder', 'Stalker', 'Herald', 'Voyager', 'Pioneer',
  'Seeker', 'Pathfinder', 'Sovereign',
];

export function generatePseudonym(): string {
  const power = POWER_WORDS[Math.floor(Math.random() * POWER_WORDS.length)];
  const hero =
    HERO_ARCHETYPES[Math.floor(Math.random() * HERO_ARCHETYPES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${power} ${hero} #${num}`;
}
