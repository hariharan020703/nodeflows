// Exact per-department mini-tree branch geometry and rotation angles, transcribed verbatim
// from the SingleFile capture of the live wheel (html1.html, #sky > .tree.mini[data-i]).
// Each branch is [junctionPoint, ...jobPoints]. junctionPoint gets a small dept-colored dot;
// each jobPoint becomes a .jdot styled by status (deployed / dev / plan). The whole branch
// set is wrapped in a div rotated by `rotate` degrees around (0,0) — reproducing the exact
// fan-out orientation from the source, whose branch coordinates were captured pre-rotation.

function j(x, y, status = 'deployed') {
  return { x, y, status }
}

export const WHEEL_TREES = {
  sales: {
    rotate: 180,
    branches: [
      [j(-66.3, -44.7), j(-123.7, -77.5), j(-158.5, -125.2), j(-224.1, -127.8, 'dev'), j(-246.4, -194.6, 'dev')],
      [j(-37.6, -70.6), j(-72.9, -126.5), j(-81.2, -185), j(-137.9, -218.1), j(-126.2, -287.5)],
      [j(0, -80), j(-4.9, -145.9), j(15.1, -201.4), j(-19.3, -257.3), j(23.5, -313.1)],
      [j(37.6, -70.6), j(64.2, -131.1), j(96, -151.8), j(85.7, -195.2), j(131.9, -208.6), j(112.7, -256.7), j(167.8, -265.4)],
      [j(66.3, -44.7), j(118.2, -85.7), j(175.5, -100.1), j(202.5, -159.9, 'dev'), j(272.7, -155.6)],
    ],
  },
  deals: {
    rotate: 231.43,
    branches: [
      [j(-66.3, -44.7), j(-123.7, -77.5), j(-147.5, -116.5, 'dev'), j(-199.8, -114), j(-213.5, -168.6), j(-272.7, -155.6)],
      [j(-37.6, -70.6), j(-72.9, -126.5), j(-81.2, -185), j(-137.9, -218.1), j(-126.2, -287.5, 'dev')],
      [j(0, -80), j(-4.9, -145.9), j(14.1, -187.5), j(-17.2, -229.4), j(20.4, -271.2), j(-23.5, -313.1, 'dev')],
      [j(37.6, -70.6), j(64.2, -131.1), j(100.5, -158.9), j(92.5, -210.6), j(145.3, -229.9, 'dev'), j(126.2, -287.5)],
      [j(66.3, -44.7), j(118.2, -85.7), j(163.3, -93.2), j(180.5, -142.5, 'dev'), j(236.3, -134.8), j(246.4, -194.6, 'plan')],
    ],
  },
  marketing: {
    rotate: 282.86,
    branches: [
      [j(-66.3, -44.7), j(-123.7, -77.5), j(-158.5, -125.2), j(-224.1, -127.8), j(-246.4, -194.6)],
      [j(-37.6, -70.6), j(-72.9, -126.5), j(-66.2, -150.8), j(-98, -155), j(-81.2, -185), j(-117.9, -186.5), j(-96.2, -219.1, 'dev'), j(-137.9, -218.1, 'dev'), j(-111.2, -253.3, 'dev'), j(-157.8, -249.6), j(-126.2, -287.5)],
      [j(0, -80), j(-4.9, -145.9), j(17.2, -229.4, 'dev'), j(-23.5, -313.1)],
      [j(37.6, -70.6), j(64.2, -131.1, 'dev'), j(107.9, -170.7), j(103.7, -236.2), j(167.8, -265.4)],
      [j(66.3, -44.7), j(118.2, -85.7), j(272.7, -155.6)],
    ],
  },
  operations: {
    rotate: 334.29,
    branches: [
      [j(-66.3, -44.7), j(-123.7, -77.5), j(-180.5, -142.5, 'dev'), j(-272.7, -155.6)],
      [j(-37.6, -70.6), j(-72.9, -126.5), j(-72.2, -164.4), j(-113.9, -180.2, 'dev'), j(-99.2, -226), j(-149.8, -237, 'dev'), j(-126.2, -287.5, 'dev')],
      [j(0, -80), j(-4.9, -145.9, 'dev'), j(17.2, -229.4), j(-23.5, -313.1, 'dev')],
      [j(37.6, -70.6), j(64.2, -131.1), j(122.9, -194.4), j(126.2, -287.5)],
      [j(66.3, -44.7), j(118.2, -85.7), j(175.5, -100.1), j(202.5, -159.9, 'plan'), j(272.7, -155.6, 'dev')],
    ],
  },
  intelligence: {
    rotate: 25.71,
    branches: [
      [j(-66.3, -44.7), j(-123.7, -77.5), j(-158.5, -125.2), j(-224.1, -127.8), j(-246.4, -194.6, 'dev')],
      [j(-37.6, -70.6), j(-72.9, -126.5), j(-92.5, -210.6, 'plan'), j(-167.8, -265.4, 'dev')],
      [j(0, -80), j(-4.9, -145.9), j(15.1, -201.4), j(-19.3, -257.3), j(23.5, -313.1)],
      [j(37.6, -70.6), j(64.2, -131.1, 'dev'), j(122.9, -194.4, 'dev'), j(126.2, -287.5)],
      [j(66.3, -44.7), j(118.2, -85.7), j(199.8, -114), j(246.4, -194.6)],
    ],
  },
  customer: {
    rotate: 77.14,
    branches: [
      [j(-58.2, -54.9), j(-109.5, -96.6, 'dev'), j(-136.1, -149.2), j(-200.4, -162.5, 'dev'), j(-211.6, -232)],
      [j(0, -80), j(-4.9, -145.9), j(13.5, -179.1, 'dev'), j(-16, -212.6, 'dev'), j(18.5, -246.1, 'plan'), j(-21, -279.6, 'dev'), j(23.5, -313.1)],
      [j(58.2, -54.9), j(102.8, -103.7), j(156.9, -127.2, 'dev'), j(173.9, -190.6, 'plan'), j(243.9, -197.8, 'plan')],
    ],
  },
  backoffice: {
    rotate: 128.57,
    branches: [
      [j(-68.1, -42), j(-126.8, -72.4), j(-186.2, -135.1), j(-278.9, -144.4, 'dev')],
      [j(-45.9, -65.5), j(-87.7, -116.7), j(-160.3, -270)],
      [j(-16.2, -78.3), j(-34.3, -141.9, 'dev'), j(-40.3, -311.4)],
      [j(16.2, -78.3), j(24.7, -143.9), j(51.7, -180.7, 'dev'), j(29.5, -228.1), j(74.8, -261.5, 'dev'), j(40.3, -311.4, 'plan')],
      [j(45.9, -65.5), j(79.7, -122.4), j(198.9, -243)],
      [j(68.1, -42), j(121.6, -80.8, 'plan'), j(179.4, -92.9, 'dev'), j(208.8, -151.5), j(278.9, -144.4, 'dev')],
    ],
  },
}

// The captured fans are wider than they are long (279 tangential vs 313 radial), so at seven
// departments 51.4deg apart each one spans ~86deg and ploughs into both neighbours.
//
// The fix works in polar coordinates in the tree's own frame (outward = -y): squeeze each
// point's ANGLE off the outward axis, and scale its RADIUS. Narrowing the fan this way keeps
// every point's distance from the badge intact — squashing raw x instead would drag the inner
// junctions inward (a point at 80px would land at 84px, i.e. under the 144px badge) and would
// compress the branch zigzags until the dots overlapped each other.
//
// Keep ANGLE_SQUEEZE at or below ~0.65 or the fans touch again: the span is 60.8deg at 0.90,
// 54.0 at 0.80, 47.2 at 0.70, 40.4 at 0.60. 0.55 leaves ~14deg of clear air.
export const ANGLE_SQUEEZE = 0.75
export const TREE_SCALE = 1.4

function transform(p) {
  const theta = Math.atan2(p.x, -p.y) * ANGLE_SQUEEZE
  const r = Math.hypot(p.x, p.y) * TREE_SCALE
  return { ...p, x: r * Math.sin(theta), y: -r * Math.cos(theta) }
}

const TREES = {}
for (const [key, tree] of Object.entries(WHEEL_TREES)) {
  TREES[key] = { branches: tree.branches.map((b) => b.map(transform)) }
}

// How far the deepest branch point reaches outward from the badge, measured after the
// transform rather than assumed — the label ring and hover wedge derive from it.
const TREE_OUTWARD_REACH = Math.max(
  ...Object.values(TREES).flatMap((t) => t.branches.flat().map((p) => -p.y)),
)

// Clear space between the outermost branch node and the department name. This is the knob for
// that gap — but note it also pushes the label ring outward, which grows the world radius the
// wheel has to fit, so the render scale drops a little in exchange: at 1080p, 170 gave ~70px of
// gap at 0.41 scale, 260 gives ~99px at 0.38.
export const LABEL_GAP = 320

// Where a department's name sits, measured outward from its badge — derived from the branch
// reach above, so the gap stays constant instead of the branches growing into a fixed radius.
export const WHEEL_LABEL_OFFSET = Math.round(TREE_OUTWARD_REACH + LABEL_GAP)

// Mini-tree lookup for the wheel view. `rotate` is derived from the department's index/count
// (the same even-step formula as its wheel position in data.js) so the ring reflows when a
// department is added or removed; a cluster with no hand-authored branch set falls back to the
// first shape. Everything is precomputed above, so Mini's per-render calls keep returning the
// same objects rather than freshly allocated ones.
export function getWheelTree(deptKey, deptIndex, deptCount) {
  const rotate = (180 + (deptIndex * 360) / deptCount) % 360
  const t = TREES[deptKey] || TREES.sales
  return { rotate, branches: t.branches }
}

export function wheelJobCount(deptKey) {
  const t = WHEEL_TREES[deptKey] || WHEEL_TREES.sales
  return t.branches.reduce((n, b) => n + b.length, 0)
}
