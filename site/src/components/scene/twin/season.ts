/**
 * The vegetation calendar for coastal Agder (Lindesnes): when birch and oak come into leaf, turn
 * and drop their leaves, and how far the fields and broadleaf woods are from summer green. Typical
 * dates for the coast of southern Norway; a single year will be a week or two either way.
 */
export type Season = {
  winter: number;                    // 0 summer .. 1 deep winter (ground and fields)
  autumn: number;                    // 0 .. 1 autumn colour on the ground
  birch: { leaf: number; turn: number };   // leaf 0 bare .. 1 full; turn 0 green .. 1 yellow
  oak: { leaf: number; turn: number };     // oak turns brown and holds dry leaves into winter
};

const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Day of the year (1..365) for a month (1..12) and day. */
export function dayOfYear(month: number, day = 15) {
  const starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return starts[Math.min(12, Math.max(1, month)) - 1] + day;
}

export function season(month: number, day = 21): Season {
  const d = dayOfYear(month, day);
  const birchLeaf = smooth(112, 138, d) * (1 - smooth(282, 312, d));
  const birchTurn = smooth(255, 290, d);
  const oakLeaf = smooth(128, 150, d) * (1 - smooth(295, 330, d) * 0.92);   // oaks keep a few dry leaves
  const oakTurn = smooth(270, 305, d);
  // the ground: straw and bare from late November to mid April
  const winter = Math.max(smooth(300, 335, d), 1 - smooth(85, 135, d));
  const autumn = smooth(262, 290, d) * (1 - smooth(305, 330, d));
  return { winter, autumn, birch: { leaf: birchLeaf, turn: birchTurn }, oak: { leaf: oakLeaf, turn: oakTurn } };
}
