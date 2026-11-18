// ?shot= scene staging for the maker's screenshots. Each scene puts the player, cars,
// police and camera in their marks, lets the world settle a few frames, then raises
// window.__shotReady so the screenshot rig can capture it.
import { CFG } from './config.js';
import { streetCoord, blockCoord } from './world.js';

export const SHOT_NAMES = ['cover', 'foot', 'drive', 'chase'];

export function applyShot(name, game) {
  const { world, player, traffic, peds, police, missions } = game;
  const set = (x, z, heading, camYaw) => {
    player.reset(x, z, heading);
    player.camYaw = camYaw ?? heading;
    player.camPitch = 0.32;
  };
  if (name === 'cover') {
    // Wide downtown vista: hero standing by the gold coupe on the avenue,
    // towers ahead, the garage wall out of frame.
    const coupe = traffic.cars.find((c) => c.isStoryCoupe) || traffic.cars[0];
    coupe.x = streetCoord(4);
    coupe.z = streetCoord(5);
    coupe.heading = Math.PI;
    coupe.syncMesh();
    set(streetCoord(4) - 4, streetCoord(5) + 10, Math.PI * 0.95, Math.PI * 0.95);
    player.camDist = 10;
    player.camPitch = 0.36;
    game.started = true;
    missions.startStory();
  } else if (name === 'foot') {
    // On foot on a downtown street, pedestrians strolling, traffic passing.
    set(streetCoord(4) + 3, streetCoord(3) + 10, Math.PI * 0.9, Math.PI * 0.9);
    player.camDist = 9;
    player.camPitch = 0.38;
    game.started = true;
    missions.startStory();
  } else if (name === 'drive') {
    // Driving down the main avenue with traffic around; auto-throttle keeps it moving.
    // Take the nearest moving traffic car and put it on the avenue, aligned with the road.
    let car = null;
    let bd = Infinity;
    for (const c of traffic.cars) {
      if (c.driver !== 'traffic') continue;
      const d = (c.x - streetCoord(4)) ** 2 + (c.z - streetCoord(2)) ** 2;
      if (d < bd) { bd = d; car = c; }
    }
    if (car) {
      car.x = streetCoord(4);
      car.z = streetCoord(2);
      car.heading = 0;
      car.speed = 16;
      car.syncMesh();
      player.reset(car.x, car.z, 0);
      player.tryEnterCar(car);
    } else {
      set(streetCoord(4), streetCoord(2), 0, 0);
    }
    game.autoDrive = true;
    player.camDist = 10;
    player.camPitch = 0.2;
    game.started = true;
    missions.startStory();
  } else if (name === 'chase') {
    // Four-star chase: hero in the gold coupe, PD interceptors closing in.
    const coupe = traffic.cars.find((c) => c.isStoryCoupe) || traffic.cars[0];
    // Put the coupe on the avenue (street centre) so the chase runs down the road.
    coupe.x = streetCoord(4);
    coupe.z = streetCoord(6);
    coupe.heading = Math.PI / 2;
    coupe.syncMesh();
    player.reset(coupe.x, coupe.z, coupe.heading);
    player.tryEnterCar(coupe);
    coupe.speed = 22;
    game.autoDrive = true;
    police.addHeat(300);
    police.spawnPursuitCar(player.pos);
    police.spawnPursuitCar(player.pos);
    police.spawnFootCop(player.pos);
    player.camDist = 11;
    player.camPitch = 0.3;
    game.started = true;
    missions.startStory();
    game.hud.say('MARISOL', '"Last one, Reno. Four stars on us already — get to the plane and don\'t stop."', 6);
    game.hud.setObjective('Solbay Goodbye — Escape to the plane on the runway!');
  } else {
    return false;
  }
  // Hide the title screen for staged shots.
  game.showTitle(false);
  return true;
}

// After staging, let the simulation settle, then flag readiness for the rig.
export function armShotReady(game, frames = 45) {
  let n = 0;
  const tick = () => {
    if (++n >= frames) {
      window.__shotReady = true;
      return;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
