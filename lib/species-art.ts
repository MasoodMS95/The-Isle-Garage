// Released Evrima catalog checked 2026-09-06; sources and exclusions: docs/SPECIES.md.
// Original bundled SVGs; only allowlisted paths can reach image renderers.
export const speciesList = [
  'Allosaurus',
  'Austroraptor',
  'Beipiaosaurus',
  'Carnotaurus',
  'Ceratosaurus',
  'Deinosuchus',
  'Diabloceratops',
  'Dilophosaurus',
  'Dryosaurus',
  'Gallimimus',
  'Herrerasaurus',
  'Hypsilophodon',
  'Kentrosaurus',
  'Maiasaura',
  'Omniraptor',
  'Pachycephalosaurus',
  'Pteranodon',
  'Stegosaurus',
  'Tenontosaurus',
  'Triceratops',
  'Troodon',
  'Tyrannosaurus',
] as const;
const aliases: Record<string, string> = {
  't-rex': 'tyrannosaurus',
  't rex': 'tyrannosaurus',
  trex: 'tyrannosaurus',
  pachy: 'pachycephalosaurus',
};
export function speciesArtwork(species: string) {
  const input = species.trim().toLowerCase();
  const normalized = Object.hasOwn(aliases, input) ? aliases[input] : input;
  const name = speciesList.find((item) => item.toLowerCase() === normalized);
  return {
    src: '/dinosaurs/' + (name ? name.toLowerCase() : 'unknown') + '.svg',
    alt: name
      ? name + ' — stylized species illustration'
      : 'Species artwork unavailable',
  };
}
