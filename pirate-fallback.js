import * as THREE from './vendor/three.module.js';
import {SVGRenderer} from './vendor/SVGRenderer.js';
import {createShip} from './pirate-ship.js';
import {VoyageClock,voyagePosition} from './voyage.mjs';

// Same original 3D model, projected to SVG when a browser cannot create WebGL.
export function createPirateFallback(map){
  const clock=new VoyageClock(matchMedia('(prefers-reduced-motion: reduce)').matches);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(36,1,.1,500);
  camera.position.set(65,48,84);camera.lookAt(0,15,0);
  const model=createShip();scene.add(model.ship);scene.add(new THREE.AmbientLight(0xffffff,.55));
  const sun=new THREE.DirectionalLight(0xfff2d9,.7);sun.position.set(-40,80,30);scene.add(sun);
  const renderer=new SVGRenderer();renderer.setSize(160,160);renderer.setQuality('high');
  renderer.domElement.setAttribute('aria-hidden','true');
  const p=voyagePosition(0),marker=L.marker([p.lat,p.lng],{interactive:false,keyboard:false,zIndexOffset:1500,icon:L.divIcon({className:'pirate-svg-marker',html:'',iconSize:[160,160],iconAnchor:[80,110]})}).addTo(map);
  marker.getElement().append(renderer.domElement);
  let frame=null,visible=true,disposed=false,lastDraw=0;
  function draw(now){
    frame=null;if(disposed||!visible||document.hidden)return;
    const seconds=clock.tick(now);
    if(now-lastDraw>45||clock.paused){
      lastDraw=now;const p=voyagePosition(seconds);marker.setLatLng([p.lat,p.lng]);
      model.ship.rotation.set(Math.sin(seconds*1.1)*.025,p.heading,Math.sin(seconds*1.7)*.035);
      model.ship.position.y=Math.sin(seconds*1.4)*.3;
      const verts=model.flag.geometry.attributes.position;
      for(let i=0;i<verts.count;i++)verts.setZ(i,Math.sin(model.flagBase[i*3]*.65-seconds*3)*.28*((model.flagBase[i*3]+4.5)/9));
      verts.needsUpdate=true;renderer.render(scene,camera);renderer.domElement.style.background='transparent';
    }
    if(!clock.paused)frame=requestAnimationFrame(draw);
  }
  function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw);}
  function visibility(){clock.setSuspended(!visible||document.hidden);if(visible&&!document.hidden)schedule();else cancelAnimationFrame(frame);}
  document.addEventListener('visibilitychange',visibility);visibility();
  return {
    clock,
    setPaused(value){clock.setPaused(value);schedule();},
    setVisible(value){visible=value;marker.getElement().hidden=!value;visibility();},
    focus(){const p=voyagePosition(clock.seconds);map.setView([p.lat-.02,p.lng+.1],9,{animate:!matchMedia('(prefers-reduced-motion: reduce)').matches});},
    destroy(){disposed=true;cancelAnimationFrame(frame);document.removeEventListener('visibilitychange',visibility);marker.remove();const geometries=new Set(),materials=new Set();scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  };
}
