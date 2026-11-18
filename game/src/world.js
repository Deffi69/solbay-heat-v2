// The city of Solbay: a 9x9 street grid, downtown towers, beach + pier + marina to the
// south and west, harbour warehouses east, airfield north-east. All geometry is procedural
// (boxes, cylinders, canvas textures) — no loaded assets. Collision is AABB-based.
import * as THREE from 'three';
import { CFG } from './config.js';
import { mulberry32, range, pick } from './random.js';

function windowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 8; y < 120; y += 16) {
    for (let x = 6; x < 58; x += 14) {
      g.fillStyle = Math.random() < lit ? '#ffd98a' : '#1d2733';
      g.fillRect(x, y, 9, 10);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function asphaltTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#33363b'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#2b2e33' : '#3a3d43';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  // No stripe in the texture: the centre line is drawn by instanced dashes,
  // and a stripe here would stretch into a gold slab across each road plane.
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function sandTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#e3c98f'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#d9bd7f' : '#ecd5a1';
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(24, 4);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function waterTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#1e6f8e'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    const y = Math.random() * 128;
    g.moveTo(0, y);
    g.bezierCurveTo(40, y + 6, 80, y - 6, 128, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(18, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function streetCoord(i) { return (i - 4) * CFG.SPACING; }
export function blockCoord(i) { return (i - 3.5) * CFG.SPACING; } // block centres, i in 0..7

export function districtOf(bx, bz) {
  if (bx >= 3 && bx <= 4 && bz >= 3 && bz <= 4) return 'downtown';
  if (bx <= 1 && bz >= 5) return 'marina';
  if (bx >= 6 && bz <= 1) return 'airfield';
  if (bx >= 6 && bz >= 5) return 'harbour';
  if (bz >= 6) return 'beachside';
  return 'residential';
}

export class World {
  constructor(scene, seed = 20261117) {
    this.scene = scene;
    this.rng = mulberry32(seed);
    this.colliders = []; // {x0,z0,x1,z1}
    this.roadLines = []; // street coords along x and z
    for (let i = 0; i < CFG.GRID; i++) this.roadLines.push(streetCoord(i));
    this.markers = {};
    this.palms = [];
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildPierMarina();
    this.buildAirfield();
    this.buildStreetProps();
    this.buildSky();
  }

  addCollider(x0, z0, x1, z1) { this.colliders.push({ x0, z0, x1, z1 }); }

  box(w, h, d, color, x, y, z, opts = {}) {
    const mat = opts.material || new THREE.MeshLambertMaterial({ color });
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (opts.ry) m.rotation.y = opts.ry;
    m.castShadow = !!opts.shadow;
    m.receiveShadow = true;
    (opts.parent || this.group).add(m);
    return m;
  }

  buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 900),
      new THREE.MeshLambertMaterial({ color: 0x6f8f5a }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, -0.05, 20);
    g.receiveShadow = true;
    this.group.add(g);
    // Sidewalk slabs under the whole grid (lighter than grass).
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(CFG.WORLD_HALF * 2 + 24, CFG.WORLD_HALF * 2 + 24),
      new THREE.MeshLambertMaterial({ color: 0x9aa0a3 }),
    );
    slab.rotation.x = -Math.PI / 2;
    slab.position.set(0, 0, 0);
    slab.receiveShadow = true;
    this.group.add(slab);
  }

  buildRoads() {
    const tex = asphaltTexture();
    const roadMat = new THREE.MeshLambertMaterial({ map: tex });
    const half = CFG.WORLD_HALF;
    for (const c of this.roadLines) {
      const along = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 12, CFG.STREET_W), roadMat);
      along.rotation.x = -Math.PI / 2;
      along.position.set(0, 0.02, c);
      along.receiveShadow = true;
      this.group.add(along);
      const across = new THREE.Mesh(new THREE.PlaneGeometry(CFG.STREET_W, half * 2 + 12), roadMat);
      across.rotation.x = -Math.PI / 2;
      across.position.set(c, 0.02, 0);
      across.receiveShadow = true;
      this.group.add(across);
    }
    // Centre dashes: instanced thin white boxes along every street.
    const dashGeo = new THREE.BoxGeometry(3, 0.06, 0.35);
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5e9c8 });
    const dashes = [];
    for (const c of this.roadLines) {
      for (let t = -half; t <= half; t += 9) {
        if (this.roadLines.some((r) => Math.abs(t - r) < 7)) continue; // skip intersections
        dashes.push([t, c, 0]);
        dashes.push([c, t, Math.PI / 2]);
      }
    }
    const inst = new THREE.InstancedMesh(dashGeo, dashMat, dashes.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    dashes.forEach(([x, z, ry], i) => {
      e.set(0, ry, 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(x, 0.05, z), q, new THREE.Vector3(1, 1, 1));
      inst.setMatrixAt(i, m4);
    });
    this.group.add(inst);
  }

  buildBlocks() {
    const rng = this.rng;
    const winLow = windowTexture('#7a6a58', 0.25);
    const winMid = windowTexture('#5d6b7a', 0.3);
    const winTower = windowTexture('#3d4a5c', 0.35);
    const mats = {
      low: new THREE.MeshLambertMaterial({ map: winLow }),
      mid: new THREE.MeshLambertMaterial({ map: winMid }),
      tower: new THREE.MeshLambertMaterial({ map: winTower }),
      ware: new THREE.MeshLambertMaterial({ color: 0x8a7a68 }),
      hangar: new THREE.MeshLambertMaterial({ color: 0x7d8a94 }),
    };
    const clubMat = new THREE.MeshLambertMaterial({ color: 0x7a2e6d, emissive: 0x2a0a24 });
    for (let bx = 0; bx < 8; bx++) {
      for (let bz = 0; bz < 8; bz++) {
        const cx = blockCoord(bx), cz = blockCoord(bz);
        const d = districtOf(bx, bz);
        if (d === 'airfield') continue; // handled separately
        if (d === 'harbour') {
          // Warehouses: two big sheds per block.
          for (const [dx, dz] of [[-9, -8], [10, 9]]) {
            this.box(20, 9, 14, 0, cx + dx, 4.5, cz + dz, { material: mats.ware, shadow: true });
            this.addCollider(cx + dx - 10, cz + dz - 7, cx + dx + 10, cz + dz + 7);
          }
          continue;
        }
        if (d === 'marina') {
          // Low pastel houses + a few palms.
          for (let k = 0; k < 3; k++) {
            const w = range(rng, 8, 13), dep = range(rng, 8, 12), h = range(rng, 5, 9);
            const x = cx + range(rng, -12, 12), z = cz + range(rng, -12, 12);
            const col = pick(rng, [0xe8d8b0, 0xd8e8e0, 0xf0c8a8, 0xc8d8e8]);
            this.box(w, h, dep, col, x, h / 2, z, { shadow: true });
            this.addCollider(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2);
          }
          continue;
        }
        if (d === 'downtown') {
          // Towers: 2-4 per block, tall, with a plaza gap.
          const n = 2 + Math.floor(rng() * 3);
          for (let k = 0; k < n; k++) {
            const w = range(rng, 12, 18), dep = range(rng, 12, 18);
            const h = range(rng, 34, 78);
            const x = cx + range(rng, -10, 10), z = cz + range(rng, -10, 10);
            const mesh = this.box(w, h, dep, 0, x, h / 2, z, { material: mats.tower, shadow: true });
            mesh.material = mats.tower;
            this.addCollider(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2);
          }
          // Club Azahar occupies the central downtown block.
          if (bx === 4 && bz === 4) {
            const club = this.box(16, 7, 12, 0, cx, 3.5, cz, { material: clubMat, shadow: true });
            club.name = 'club-azahar';
            this.addCollider(cx - 8, cz - 6, cx + 8, cz + 6);
            this.markers.club = { x: cx, z: cz - 10, label: 'Club Azahar' };
          }
          continue;
        }
        // Residential / beachside: 2-4 small houses + gardens.
        const n = 2 + Math.floor(rng() * 3);
        for (let k = 0; k < n; k++) {
          const w = range(rng, 8, 14), dep = range(rng, 8, 13), h = range(rng, 5, 12);
          const x = cx + range(rng, -12, 12), z = cz + range(rng, -12, 12);
          const col = pick(rng, [0xd8c8a8, 0xc8b89a, 0xe0d8c8, 0xb8c8a8]);
          this.box(w, h, dep, col, x, h / 2, z, { material: mats.low, shadow: true });
          // Pitched roof prism.
          const roof = new THREE.Mesh(
            new THREE.ConeGeometry(Math.max(w, dep) * 0.72, 3, 4),
            new THREE.MeshLambertMaterial({ color: pick(rng, [0x8a4a3a, 0x5a6a7a, 0x7a5a3a]) }),
          );
          roof.position.set(x, h + 1.5, z);
          roof.rotation.y = Math.PI / 4;
          this.group.add(roof);
          this.addCollider(x - w / 2, z - dep / 2, x + w / 2, z + dep / 2);
        }
      }
    }
    // Piper's garage (gold coupe lot) — downtown south edge.
    const gx = blockCoord(4), gz = streetCoord(6) + 10;
    this.box(18, 6, 12, 0, gx, 3, gz, { material: new THREE.MeshLambertMaterial({ color: 0x4a6a8a }), shadow: true });
    this.addCollider(gx - 9, gz - 6, gx + 9, gz + 6);
    this.markers.garage = { x: gx, z: gz - 10, label: "Piper's Garage" };
    // Gold coupe lot marker.
    this.markers.coupeLot = { x: gx + 16, z: gz, label: 'Gold Coupe' };
  }

  buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 60),
      new THREE.MeshLambertMaterial({ map: sandTexture() }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, CFG.BEACH_Z + 30);
    sand.receiveShadow = true;
    this.group.add(sand);
    this.waterTex = waterTexture();
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(900, 300),
      new THREE.MeshLambertMaterial({ map: this.waterTex, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, CFG.WATER_Z + 150);
    this.group.add(water);
    // Boardwalk strip along the sand.
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 8),
      new THREE.MeshLambertMaterial({ color: 0x9a7a52 }),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(0, 0.06, CFG.BEACH_Z + 4);
    walk.receiveShadow = true;
    this.group.add(walk);
    this.markers.beach = { x: -40, z: CFG.BEACH_Z + 24, label: 'Solbay Beach' };
    // Palms along the boardwalk.
    this.palmRows(-240, 240, CFG.BEACH_Z + 12, 26);
  }

  palmRows(x0, x1, z, step) {
    const rng = this.rng;
    const trunkGeo = new THREE.CylinderGeometry(0.25, 0.4, 6, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6a4a2a });
    const leafGeo = new THREE.ConeGeometry(3.2, 3.4, 7);
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e7a3a });
    const spots = [];
    for (let x = x0; x <= x1; x += step) spots.push([x + range(rng, -6, 6), z + range(rng, -2, 2)]);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, spots.length);
    const leaves = new THREE.InstancedMesh(leafGeo, leafMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(([x, zz], i) => {
      m4.compose(new THREE.Vector3(x, 3, zz), q, new THREE.Vector3(1, 1, 1));
      trunks.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, 7.2, zz), q, new THREE.Vector3(1, 1, 1));
      leaves.setMatrixAt(i, m4);
      this.palms.push({ x, z: zz });
    });
    trunks.castShadow = true;
    this.group.add(trunks, leaves);
  }

  buildPierMarina() {
    // Pier from the boardwalk out into the water.
    const rng = this.rng;
    const pierX = -120;
    for (let z = CFG.BEACH_Z + 8; z < CFG.WATER_Z + 60; z += 4) {
      this.box(10, 0.5, 3.6, 0x8a6a42, pierX, 1.2, z, { shadow: false });
    }
    for (let z = CFG.BEACH_Z + 12; z < CFG.WATER_Z + 60; z += 12) {
      this.box(0.5, 2.4, 0.5, 0x5a4030, pierX - 4.6, 0, z);
      this.box(0.5, 2.4, 0.5, 0x5a4030, pierX + 4.6, 0, z);
    }
    this.markers.pier = { x: pierX, z: CFG.WATER_Z + 30, label: 'Solbay Pier' };
    // Marina docks on the west edge.
    const dockX = -CFG.WORLD_HALF - 6;
    for (let z = 60; z <= 200; z += 28) {
      this.box(3, 0.5, 18, 0x8a6a42, dockX, 1.0, z);
      // A moored boat: hull + cabin + mast.
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(4, 1.6, 12), new THREE.MeshLambertMaterial({ color: pick(rng, [0xe8e8e8, 0x2a6a8a, 0xc84a3a]) }));
      hull.position.y = 0.8;
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 4), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
      cabin.position.set(0, 2.2, -1);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 7, 5), new THREE.MeshLambertMaterial({ color: 0x888888 }));
      mast.position.set(0, 5, 1);
      boat.add(hull, cabin, mast);
      boat.position.set(dockX - 6, 0.4, z + 4);
      boat.rotation.y = range(rng, -0.1, 0.1);
      this.group.add(boat);
    }
    this.markers.marina = { x: dockX - 4, z: 120, label: 'Marina' };
  }

  buildAirfield() {
    const ax = blockCoord(7), az = blockCoord(0);
    // Runway strip.
    const runway = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 130),
      new THREE.MeshLambertMaterial({ color: 0x2e2e33 }),
    );
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(ax + 10, 0.04, az);
    runway.receiveShadow = true;
    this.group.add(runway);
    for (let z = az - 55; z <= az + 55; z += 12) {
      this.box(1, 0.06, 5, 0xf0f0f0, ax + 10, 0.07, z);
    }
    // Hangars.
    for (const [dx, dz] of [[-14, -30], [-14, 30]]) {
      this.box(16, 10, 22, 0, ax + dx, 5, az + dz, { material: new THREE.MeshLambertMaterial({ color: 0x7d8a94 }), shadow: true });
      this.addCollider(ax + dx - 8, az + dz - 11, ax + dx + 8, az + dz + 11);
    }
    // A small prop plane at the runway end.
    const plane = new THREE.Group();
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 9, 8), new THREE.MeshLambertMaterial({ color: 0xd8d8d8 }));
    fus.rotation.x = Math.PI / 2;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 2), new THREE.MeshLambertMaterial({ color: 0xc84a3a }));
    const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 1.4), new THREE.MeshLambertMaterial({ color: 0xc84a3a }));
    tail.position.set(0, 0.4, -4.4);
    const prop = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, 0.3), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    prop.position.set(0, 0, 4.8);
    plane.add(fus, wing, tail, prop);
    plane.position.set(ax + 10, 1.2, az + 48);
    plane.rotation.y = Math.PI;
    this.group.add(plane);
    this.markers.airfield = { x: ax + 10, z: az + 48, label: 'Solbay Airfield' };
    this.markers.hangar = { x: ax - 14, z: az + 30, label: 'Hangar 2' };
  }

  buildStreetProps() {
    const rng = this.rng;
    // Streetlights at intersections.
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 7, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
    const headGeo = new THREE.SphereGeometry(0.35, 8, 6);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const spots = [];
    for (const x of this.roadLines) for (const z of this.roadLines) spots.push([x + 7, z + 7]);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, spots.length);
    const heads = new THREE.InstancedMesh(headGeo, headMat, spots.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    spots.forEach(([x, z], i) => {
      m4.compose(new THREE.Vector3(x, 3.5, z), q, new THREE.Vector3(1, 1, 1));
      poles.setMatrixAt(i, m4);
      m4.compose(new THREE.Vector3(x, 7.1, z), q, new THREE.Vector3(1, 1, 1));
      heads.setMatrixAt(i, m4);
    });
    this.group.add(poles, heads);
    // Crates + dumpsters near warehouses and alleys.
    const crateMat = new THREE.MeshLambertMaterial({ color: 0x9a7a4a });
    for (let i = 0; i < 26; i++) {
      const x = range(rng, -220, 220), z = range(rng, -220, 220);
      if (this.roadLines.some((r) => Math.abs(x - r) < 8) || this.roadLines.some((r) => Math.abs(z - r) < 8)) continue;
      const s = range(rng, 1, 2);
      this.box(s, s, s, 0, x, s / 2, z, { material: crateMat });
      this.addCollider(x - s / 2, z - s / 2, x + s / 2, z + s / 2);
    }
    // Taxi rank + parcel depot markers (green ranks).
    this.markers.taxi = { x: streetCoord(2) + 8, z: streetCoord(4) - 8, label: 'Taxi Rank' };
    this.markers.parcel = { x: blockCoord(6), z: streetCoord(7) + 8, label: 'Parcel Depot' };
    this.markers.warehouse = { x: blockCoord(7), z: blockCoord(6), label: 'Harbour Warehouse' };
  }

  buildSky() {
    this.sun = new THREE.DirectionalLight(0xfff2d8, 2.4);
    this.sun.position.set(180, 260, 120);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -260; this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260; this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 800;
    this.scene.add(this.sun);
    this.scene.add(new THREE.HemisphereLight(0xbfd8ff, 0x8a7a5a, 0.9));
    this.scene.fog = new THREE.Fog(0xcfe0ea, 320, 720);
    this.scene.background = new THREE.Color(0x87b5d8);
  }

  // Circle (player/car) vs building AABBs: push out, return corrected position.
  collideCircle(x, z, r) {
    for (const c of this.colliders) {
      const nx = Math.max(c.x0, Math.min(x, c.x1));
      const nz = Math.max(c.z0, Math.min(z, c.z1));
      const dx = x - nx, dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const pl = x - c.x0, pr = c.x1 - x, pt = z - c.z0, pb = c.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = c.x0 - r; else if (m === pr) x = c.x1 + r;
          else if (m === pt) z = c.z0 - r; else z = c.z1 + r;
        }
      }
    }
    // World bounds: keep inside the island (beach south, water far south blocks).
    const B = CFG.WORLD_HALF + 14;
    x = Math.max(-B - 40, Math.min(B + 40, x));
    z = Math.max(-B - 14, Math.min(CFG.WATER_Z + 40, z));
    return { x, z };
  }

  // Nearest street line to a point: for traffic AI lane following.
  nearestRoad(x, z) {
    let best = null;
    for (const c of this.roadLines) {
      const dz = Math.abs(z - c);
      if (!best || dz < best.d) best = { axis: 'z', coord: c, d: dz };
      const dx = Math.abs(x - c);
      if (dx < best.d) best = { axis: 'x', coord: c, d: dx };
    }
    return best;
  }

  update(dt, elapsed) {
    // Slow sun drift + water shimmer.
    const t = elapsed * 0.02;
    this.sun.position.set(180 * Math.cos(t * 0.2), 260, 120 + 60 * Math.sin(t * 0.2));
    if (this.waterTex) this.waterTex.offset.x = (elapsed * 0.008) % 1;
  }
}
