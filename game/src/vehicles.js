// Cars: build, traffic AI and arcade driving. Every car is boxes + cylinders — no assets.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, pick, range, clamp, angleLerp, dist2 } from './random.js';

export const CAR_COLORS = [0xc8322e, 0x2e6ac8, 0xe8c832, 0xeeeeee, 0x222222, 0x3a8a4a, 0xc86a2e, 0x7a3a8a];
export const CAR_NAMES = ['Vento', 'Cortez', 'Marlin', 'Puma', 'Solstice', 'Brava', 'Dune', 'Falco'];

export function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.62, 4.3), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glassMat);
  cabin.position.set(0, 1.05, -0.2);
  cabin.castShadow = true;
  g.add(body, cabin);
  // Bumpers, lights, spoiler for sporty cars.
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xc8322e });
  for (const s of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), lightMat);
    hl.position.set(s * 0.62, 0.62, 2.16);
    g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.16, 0.08), tailMat);
    tl.position.set(s * 0.62, 0.62, -2.16);
    g.add(tl);
  }
  if (opts.sport) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.35), bodyMat);
    sp.position.set(0, 1.0, -2.05);
    g.add(sp);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffd23e }));
    sign.position.set(0, 1.45, -0.2);
    g.add(sign);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  g.userData.wheels = [];
  for (const [wx, wz] of [[-0.85, 1.35], [0.85, 1.35], [-0.85, -1.35], [0.85, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    g.userData.wheels.push(w);
  }
  return g;
}

export class Car {
  constructor(mesh, x, z, heading, opts = {}) {
    this.mesh = mesh;
    this.x = x; this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.color = opts.color ?? 0x888888;
    this.name = opts.name ?? 'car';
    this.isPlayer = !!opts.isPlayer;
    this.isPolice = !!opts.isPolice;
    this.isTaxi = !!opts.isTaxi;
    this.health = 100;
    this.wrecked = false;
    this.driver = opts.driver ?? null; // 'traffic' | 'police' | 'player' | null (parked)
    this.maxSpeed = opts.maxSpeed ?? CFG.CAR_MAX_SPEED;
    this.headlightL = null;
    this.headlightR = null;
    if (opts.policeLights) {
      const mk = (c, x) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.3), new THREE.MeshBasicMaterial({ color: c }));
        m.position.set(x, 1.42, -0.2);
        mesh.add(m);
        return m;
      };
      this.headlightL = mk(0xff2222, -0.4);
      this.headlightR = mk(0x2266ff, 0.4);
    }
    this.syncMesh();
  }
  syncMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    const spin = this.speed * 0.016 / 0.36;
    for (const w of this.mesh.userData.wheels) w.rotation.x += spin;
  }
  // Arcade driving step; steer -1..1, throttle -1..1.
  drive(dt, steer, throttle, handbrake, world) {
    if (this.wrecked) { this.speed *= Math.exp(-2 * dt); }
    const forward = throttle > 0 ? 1 : throttle < 0 ? -1 : 0;
    const accel = throttle !== 0 ? CFG.CAR_ACCEL * Math.abs(throttle) : 0;
    this.speed += forward * accel * dt;
    // Drag: gentle at speed while throttling, firm coasting, hard handbrake.
    if (handbrake) this.speed *= Math.exp(-3 * dt);
    else if (throttle === 0) this.speed *= Math.exp(-1.0 * dt);
    else this.speed *= Math.exp(-0.25 * dt);
    const max = throttle < 0 ? CFG.CAR_MAX_REVERSE : this.maxSpeed;
    this.speed = clamp(this.speed, -max, max);
    if (Math.abs(this.speed) < 0.05 && throttle === 0) this.speed = 0;
    // Steering scales with speed.
    const steerTarget = clamp(steer, -1, 1) * CFG.CAR_TURN * clamp(Math.abs(this.speed) / 8, 0, 1);
    this.heading += steerTarget * Math.sign(this.speed || 1) * dt * (this.speed >= 0 ? 1 : -1);
    const nx = this.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.z + Math.cos(this.heading) * this.speed * dt;
    const fixed = world.collideCircle(nx, nz, 1.6);
    if (fixed.x !== nx || fixed.z !== nz) {
      // Bumped a wall: kill most speed.
      this.speed *= 0.35;
    }
    this.x = fixed.x; this.z = fixed.z;
    this.syncMesh();
  }
}

export class Traffic {
  constructor(scene, world, seed = 7) {
    this.scene = scene;
    this.world = world;
    this.rng = mulberry32(seed);
    this.cars = [];
    this.spawnTimer = 0;
  }
  spawnCar(x, z, heading, opts = {}) {
    const color = opts.color ?? pick(this.rng, CAR_COLORS);
    const mesh = makeCarMesh(color, opts);
    this.scene.add(mesh);
    const car = new Car(mesh, x, z, heading, { ...opts, color });
    this.cars.push(car);
    return car;
  }
  // Parked cars along street edges, plus a few moving traffic cars.
  populate(count = 12) {
    const rng = this.rng;
    const lines = this.world.roadLines;
    for (let i = 0; i < count; i++) {
      const along = pick(rng, lines);
      const cross = pick(rng, lines);
      const lane = range(rng, -3, 3);
      const horizontal = rng() < 0.5;
      const x = horizontal ? cross + range(rng, -200, 200) : along + lane;
      const z = horizontal ? along + lane : cross + range(rng, -200, 200);
      const heading = horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
      const car = this.spawnCar(x, z, heading, { name: pick(rng, CAR_NAMES), driver: rng() < 0.55 ? 'traffic' : null });
      if (car.driver === 'traffic') {
        car.speed = range(rng, 6, CFG.TRAFFIC_SPEED);
        car.route = { axis: horizontal ? 'x' : 'z', dir: Math.sign(Math.sin(heading)) || 1 };
      }
    }
    // The gold coupe — story car, parked at the lot.
    const lot = this.world.markers.coupeLot;
    const coupe = this.spawnCar(lot.x, lot.z, Math.PI / 2, { color: 0xd8a820, name: 'Aurelia GT', sport: true, driver: null });
    coupe.isStoryCoupe = true;
    return coupe;
  }
  nearestCar(x, z, maxD, exclude) {
    let best = null, bd = maxD * maxD;
    for (const c of this.cars) {
      if (c === exclude || c.wrecked) continue;
      const d = dist2(x, z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }
  update(dt, playerPos) {
    // Traffic AI: follow the current street, turn at intersections, despawn far cars.
    for (const car of this.cars) {
      if (car.driver !== 'traffic' || car.wrecked) continue;
      const road = this.world.nearestRoad(car.x, car.z);
      const targetSpeed = CFG.TRAFFIC_SPEED;
      // Steer toward the lane centre of the nearest street.
      let desired = car.heading;
      if (road.axis === 'z') {
        // Travelling along x on street z=coord; lane offset by direction.
        const laneZ = road.coord + (Math.sin(car.heading) > 0 ? 3 : -3);
        const dz = laneZ - car.z;
        const along = Math.sin(car.heading);
        desired = along >= 0 ? Math.PI / 2 + clamp(-dz * 0.02, -0.5, 0.5) : -Math.PI / 2 + clamp(dz * 0.02, -0.5, 0.5);
      } else {
        const laneX = road.coord + (Math.cos(car.heading) > 0 ? 3 : -3);
        const dx = laneX - car.x;
        const along = Math.cos(car.heading);
        desired = along >= 0 ? 0 + clamp(dx * 0.02, -0.5, 0.5) : Math.PI + clamp(-dx * 0.02, -0.5, 0.5);
      }
      car.heading = angleLerp(car.heading, desired, Math.min(1, dt * 1.2));
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.world.collideCircle(nx, nz, 1.6);
      car.x = fixed.x; car.z = fixed.z;
      car.syncMesh();
      // Despawn when far from the player, respawn handled by populate timer.
      if (playerPos && dist2(car.x, car.z, playerPos.x, playerPos.z) > 320 * 320) {
        car.driver = null; // park it where it is; traffic manager respawns fresh cars elsewhere
      }
    }
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 6;
      const moving = this.cars.filter((c) => c.driver === 'traffic').length;
      if (moving < 8 && playerPos) {
        const lines = this.world.roadLines;
        const along = pick(this.rng, lines);
        const cross = pick(this.rng, lines);
        const horizontal = this.rng() < 0.5;
        const near = 60 + this.rng() * 60;
        const dir = this.rng() < 0.5 ? 1 : -1;
        const x = horizontal ? playerPos.x + dir * near : along + range(this.rng, -3, 3);
        const z = horizontal ? along + range(this.rng, -3, 3) : playerPos.z + dir * near;
        const heading = horizontal ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
        const car = this.spawnCar(x, z, heading, { name: pick(this.rng, CAR_NAMES), driver: 'traffic' });
        car.speed = CFG.TRAFFIC_SPEED;
      }
    }
  }
}
