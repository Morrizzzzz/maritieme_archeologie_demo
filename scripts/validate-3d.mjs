import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import * as THREE from '../vendor/three.module.js';
import {TripleClick,VoyageClock,voyagePosition,VOYAGE_SECONDS} from '../voyage.mjs';
import {createShip} from '../pirate-ship.js';

// Unlock exactly once after three clicks; a stale partial sequence must expire.
const clicks=new TripleClick();
assert.equal(clicks.click(0),false);assert.equal(clicks.click(500),false);assert.equal(clicks.click(1000),true);assert.equal(clicks.click(1500),false);
assert.equal(clicks.click(40000),false);assert.equal(clicks.click(40100),false);assert.equal(clicks.click(40200),true);

// Pausing and hiding the page must not accumulate an invisible voyage.
const clock=new VoyageClock();clock.tick(0);clock.tick(50);assert.equal(clock.seconds,.05);
clock.setPaused(true);clock.tick(1000);clock.tick(6000);assert.equal(clock.seconds,.05);
clock.setPaused(false);clock.tick(7000);clock.tick(7050);assert.equal(clock.seconds,.1);
clock.setSuspended(true);clock.tick(8000);clock.tick(18000);assert.equal(clock.seconds,.1);
clock.setSuspended(false);clock.tick(20000);clock.tick(20050);assert(Math.abs(clock.seconds-.15)<1e-9);

// A closed, continuous route in the chosen North Sea extent, with a valid heading.
assert.deepEqual(voyagePosition(0),voyagePosition(VOYAGE_SECONDS));
for(let t=0;t<=VOYAGE_SECONDS;t+=.5){const p=voyagePosition(t);assert(p.lng>=2.84&&p.lng<=3.96&&p.lat>=53.10&&p.lat<=53.60);assert(Number.isFinite(p.heading));}
const a=voyagePosition(VOYAGE_SECONDS-.001),b=voyagePosition(.001);assert(Math.hypot(a.lng-b.lng,a.lat-b.lat)<.001);

// The actual ship model is finite and contains its hull, masts, sails and flag.
const model=createShip(),box=new THREE.Box3().setFromObject(model.ship);
assert(box.max.y>35&&box.max.z>25&&box.min.z<-15);assert.equal(model.sails.length,4);assert.equal(model.wakes.length,5);
model.ship.traverse(object=>{const p=object.geometry?.attributes.position;if(p)assert([...p.array].every(Number.isFinite));});
// +Y is model height; the Mercator placement maps it to positive altitude.
const up=new THREE.Vector3(0,1,0).applyMatrix4(new THREE.Matrix4().makeRotationX(Math.PI/2));assert(Math.abs(up.z-1)<1e-9);

// The deployment allowlist must include every new entry module, not just the preview.
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const workflow=await readFile(path.join(root,'.github/workflows/pages.yml'),'utf8');
for(const name of ['map3d.js','voyage.mjs','pirate-ship.js','pirate-fallback.js'])assert(workflow.includes(name),`${name} ontbreekt in de Pages-publicatie.`);
const visited=new Set();
async function checkImports(file){
  if(visited.has(file))return;visited.add(file);
  const code=await readFile(file,'utf8');
  for(const match of code.matchAll(/(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g)){
    const target=path.resolve(path.dirname(file),match[2]);await access(target);if(/\.(m?js)$/.test(target))await checkImports(target);
  }
}
for(const name of ['app.js','map3d.js','pirate-ship.js','pirate-fallback.js'])await checkImports(path.join(root,name));
console.log('OK: drievoudige klik, pauze/hervatten, verborgen venster, gesloten vaarroute, 3D-model en GitHub Pages-modulepaden.');
