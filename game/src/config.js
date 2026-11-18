// SOLBAY HEAT — tuning constants and shared names. Everything invented for this game.
export const CFG = {
  // City layout: 9x9 streets, 52 units apart; blocks are 40 wide, streets 12 wide.
  GRID: 9,
  SPACING: 52,
  STREET_W: 12,
  BLOCK: 40,
  WORLD_HALF: 4 * 52 + 26, // 234 — half extent of the street grid
  // Districts (block coords, x/z in 0..8)
  DOWNTOWN: { x0: 3, z0: 3, x1: 5, z1: 5 },
  MARINA_X: 0, // west edge blocks hold the marina
  AIRFIELD: { x0: 7, z0: 0, x1: 8, z1: 1 },
  WAREHOUSE: { x0: 7, z0: 6, x1: 8, z1: 7 },
  // Beach is the strip south of the grid (z > WORLD_HALF).
  BEACH_Z: 234,
  WATER_Z: 268,
  // Player
  WALK_SPEED: 7,
  SPRINT_SPEED: 11,
  JUMP_V: 9,
  GRAVITY: 24,
  PLAYER_RADIUS: 0.7,
  PLAYER_HEALTH: 100,
  // Cars
  CAR_ACCEL: 16,
  CAR_MAX_SPEED: 34,
  CAR_MAX_REVERSE: 10,
  CAR_BRAKE: 30,
  CAR_TURN: 1.9,
  CAR_DRAG: 0.6,
  TRAFFIC_SPEED: 9,
  // Police / wanted
  WANTED_MAX: 5,
  HEAT_PER_STEAL: 40,
  HEAT_PER_SHOT: 12,
  HEAT_PER_HIT_PED: 25,
  HEAT_PER_KILL: 35,
  HEAT_DECAY: 2.2, // per second while unseen
  STAR_THRESHOLDS: [0, 30, 80, 150, 240, 360],
  // Combat
  PISTOL_DAMAGE: 34,
  PISTOL_HEADSHOT: 100,
  PISTOL_MAG: 12,
  PISTOL_RANGE: 90,
  PUNCH_DAMAGE: 12,
  PUNCH_RANGE: 2.2,
  // Economy
  START_MONEY: 250,
  TAXI_FARE_PER_M: 2,
  PARCEL_PAY: 180,
  MISSION_PAY: [300, 450, 600, 800, 1500],
  BUST_FINE: 200,
  HOSPITAL_FEE: 150,
  // Timing
  DAY_LENGTH: 240, // seconds for a full sun cycle (cosmetic)
};

export const DISTRICT_NAMES = {
  downtown: 'Downtown Solbay',
  marina: 'Marina',
  beach: 'Solbay Beach',
  harbour: 'Harbour',
  airfield: 'Solbay Airfield',
  residential: 'Palm Court',
};

export const STORY = {
  hero: 'Reno Vale',
  contact: 'Marisol Cruz',
  mechanic: 'Piper Lang',
  gang: 'the Corsairs',
  club: 'Club Azahar',
};
