import * as THREE from './vendor/three.module.js';
import {VoyageClock, voyagePosition} from './voyage.mjs';

// An original, schematic ship. No external model, images, or tracking requests.
export function createShip() {
  const ship = new THREE.Group();
  const material = color => new THREE.MeshStandardMaterial({color, roughness:.85, side:THREE.DoubleSide});
  const wood = material('#7a4227'), dark = material('#412d24'), gold = material('#ddae5e');
  const deck = material('#bc8750'), canvas = material('#fff1d1');
  function mesh(geometry, mat, x=0, y=0, z=0) {
    const object = new THREE.Mesh(geometry, mat); object.position.set(x,y,z); ship.add(object); return object;
  }
  function spar(a,b,radius=.23,mat=dark) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), vector = end.clone().sub(start);
    const object = mesh(new THREE.CylinderGeometry(radius,radius,vector.length(),8),mat);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vector.normalize());
    return object;
  }
  const outline = [[-6,-17],[6,-17],[8,-8],[7,9],[4,16],[0,22],[-4,16],[-7,9],[-8,-8]];
  const positions=[], indices=[];
  for (const y of [0,6]) for (const [x,z] of outline) positions.push(x*(y?1:.6),y,z*(y?1:.85));
  const n=outline.length;
  for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(i,j,i+n,j,j+n,i+n);}
  const hull=new THREE.BufferGeometry(); hull.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); hull.setIndex(indices);hull.computeVertexNormals();mesh(hull,wood);
  const deckShape=new THREE.Shape();outline.forEach(([x,z],i)=>i?deckShape.lineTo(x,z):deckShape.moveTo(x,z));deckShape.closePath();
  const floor=mesh(new THREE.ShapeGeometry(deckShape),deck,0,6,0);floor.rotation.x=Math.PI/2;
  // Rails, cabin, windows, cannons and bowsprit give a readable silhouette.
  for(let i=0;i<n;i++){const a=outline[i],b=outline[(i+1)%n];spar([a[0],7,a[1]],[b[0],7,b[1]],.32,gold);spar([a[0],6,a[1]],[a[0],7.3,a[1]],.18,dark);}
  mesh(new THREE.BoxGeometry(10,5,8),wood,0,8.5,-12);
  mesh(new THREE.BoxGeometry(11,1,9),dark,0,11,-12);
  for(const x of [-3,0,3])mesh(new THREE.BoxGeometry(1.4,1.8,.25),gold,x,8.8,-16.15);
  for(const z of [-7,-1,5])for(const side of [-1,1]){
    const gun=mesh(new THREE.CylinderGeometry(.55,.55,3,8),dark,side*7.4,4.3,z);gun.rotation.z=Math.PI/2;
  }
  spar([0,6,15],[0,11,28],.35,dark);
  const sails=[];
  function sail(width,height,y,z) {
    const geometry=new THREE.PlaneGeometry(width,height,12,8);
    const p=geometry.attributes.position;
    for(let i=0;i<p.count;i++)p.setZ(i,Math.sin((p.getX(i)/width+.5)*Math.PI)*Math.sin((p.getY(i)/height+.5)*Math.PI)*2.4);
    geometry.computeVertexNormals();const sail=mesh(geometry,canvas,0,y,z);sails.push(sail);
    spar([-width/2,y+height/2,z],[width/2,y+height/2,z],.18,dark);
  }
  for(const [z,height] of [[-2,34],[11,27],[-12,23]]){
    spar([0,6,z],[0,height,z],.29,dark);
    sail(z===-2?17:12,z===-2?12:9,height-8,z+.35);
    if(z===-2)sail(11,6,height-2.5,z+.35);
    for(const side of [-1,1])spar([side*6,7,z-5],[0,height-2,z],.055,dark);
  }
  // A mesh flag and a small skull on both faces also work in the SVG fallback.
  const flag=mesh(new THREE.PlaneGeometry(9,5.6,12,6),material('#172c3a'),4.5,34,-2);
  for(const side of [-1,1]){
    const z=-2+side*.65;
    for(const [a,b] of [[[2.8,32.5,z],[6.2,34,z]],[[2.8,34,z],[6.2,32.5,z]]])spar(a,b,.13,canvas);
    const skull=mesh(new THREE.SphereGeometry(1,12,8),canvas,4.5,34.6,z);skull.scale.set(1,.9,.2);
    mesh(new THREE.BoxGeometry(1.25,.55,.28),canvas,4.5,33.9,z);
    for(const x of [4.1,4.9]){const eye=mesh(new THREE.SphereGeometry(.25,8,6),dark,x,34.7,z+side*.23);eye.scale.z=.4;}
  }
  const flagBase=flag.geometry.attributes.position.array.slice();
  const wakeMaterial=new THREE.MeshBasicMaterial({color:'#ffffff',transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false});
  const wakes=[];
  for(let i=0;i<5;i++){
    const wake=mesh(new THREE.RingGeometry(4,4.4,24,1,Math.PI*.06,Math.PI*.88),wakeMaterial,0,.3,-19-i*5);
    wake.rotation.x=Math.PI/2;wakes.push(wake);
  }
  return {ship,flag,flagBase,wakes,sails};
}

export function createPirateLayer(maplibregl,{paused=false,onFrame}={}) {
  const clock=new VoyageClock(paused);
  const layer={
    id:'atlas-pirate-ship',type:'custom',renderingMode:'3d',clock,
    onAdd(map,gl){
      this.map=map;this.camera=new THREE.Camera();this.scene=new THREE.Scene();
      Object.assign(this,createShip());this.scene.add(this.ship);
      this.scene.add(new THREE.AmbientLight(0xffffff,1.8));
      const sun=new THREE.DirectionalLight(0xfff2d9,2.8);sun.position.set(-40,80,30);this.scene.add(sun);
      this.renderer=new THREE.WebGLRenderer({canvas:map.getCanvas(),context:gl,antialias:true});
      this.renderer.autoClear=false;
      this.visibility=()=>{clock.setSuspended(document.hidden||this.hidden);if(!clock.suspended)map.triggerRepaint();};
      document.addEventListener('visibilitychange',this.visibility);this.visibility();
    },
    render(gl,args){
      if(this.hidden)return;
      const t=clock.tick(performance.now()),p=voyagePosition(t);
      const origin=maplibregl.MercatorCoordinate.fromLngLat([p.lng,p.lat],0);
      // Constant screen-sized symbol; this is not a real-world ship footprint.
      const metersPerPixel=40075016.686*Math.cos(p.lat*Math.PI/180)/(512*2**this.map.getZoom());
      const scale=origin.meterInMercatorCoordinateUnits()*metersPerPixel*2.4;
      const placement=new THREE.Matrix4().makeTranslation(origin.x,origin.y,origin.z)
        .scale(new THREE.Vector3(scale,scale,scale)).multiply(new THREE.Matrix4().makeRotationX(Math.PI/2));
      this.ship.rotation.set(Math.sin(t*1.1)*.025,p.heading,Math.sin(t*1.7)*.035);
      this.ship.position.y=Math.sin(t*1.4)*.3;
      const verts=this.flag.geometry.attributes.position;
      for(let i=0;i<verts.count;i++)verts.setZ(i,Math.sin(this.flagBase[i*3]*.65-t*3)*.28*((this.flagBase[i*3]+4.5)/9));
      verts.needsUpdate=true;
      this.wakes.forEach((wake,i)=>{wake.scale.setScalar(1+i*.22+Math.sin(t*2-i)*.08);});
      this.camera.projectionMatrix.fromArray(args.defaultProjectionData.mainMatrix).multiply(placement);
      this.renderer.resetState();this.renderer.render(this.scene,this.camera);this.renderer.resetState();
      if(onFrame)onFrame(p,t);
      if(!clock.paused&&!clock.suspended)this.map.triggerRepaint();
    },
    setPaused(value){clock.setPaused(value);this.map?.triggerRepaint();},
    setHidden(value){this.hidden=value;clock.setSuspended(value||document.hidden);this.map?.triggerRepaint();},
    onRemove(){
      document.removeEventListener('visibilitychange',this.visibility);
      const geometries=new Set(),materials=new Set(),textures=new Set();
      this.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const mat of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){materials.add(mat);if(mat.map)textures.add(mat.map);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());
      this.renderer.dispose();
    }
  };
  return layer;
}
