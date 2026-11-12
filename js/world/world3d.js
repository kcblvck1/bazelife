import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { LOCATIONS } from "./locations.js";

const mat = (color, roughness=0.9) => new THREE.MeshStandardMaterial({color,roughness});
const box = (w,h,d,material,x=0,y=h/2,z=0) => { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material); m.position.set(x,y,z); m.castShadow=true; m.receiveShadow=true; return m; };

export class World3D {
  constructor(container, markerLayer, onSelect, onBedSelect=()=>{}) {
    this.container=container; this.markerLayer=markerLayer; this.onSelect=onSelect; this.onBedSelect=onBedSelect;
    this.scene=new THREE.Scene(); this.scene.background=new THREE.Color(0x9bc4d8); this.scene.fog=new THREE.Fog(0x9bc4d8,125,230);
    this.root=new THREE.Group(); this.scene.add(this.root);
    this.mapCamera=new THREE.PerspectiveCamera(43,1,0.1,500);
    this.mapCamera.position.set(103,126,103); this.mapCamera.lookAt(0,0,0);
    this.camera=new THREE.PerspectiveCamera(68,1,0.1,250);
    this.camera.position.set(0,1.65,7.5); this.camera.rotation.order="YXZ";
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    this.renderer.shadowMap.enabled=true; this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace; this.renderer.toneMapping=THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure=1.15;
    this.container.appendChild(this.renderer.domElement);
    this.ambient=new THREE.HemisphereLight(0xe7f3ff,0x78906a,2.0); this.scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight(0xfff2d8,3.1); this.sun.position.set(-45,90,55); this.sun.castShadow=true; this.sun.shadow.mapSize.set(2048,2048); this.sun.shadow.camera.left=-90; this.sun.shadow.camera.right=90; this.sun.shadow.camera.top=90; this.sun.shadow.camera.bottom=-90; this.scene.add(this.sun);
    this.controls=new OrbitControls(this.mapCamera,this.renderer.domElement); this.controls.enableDamping=true; this.controls.dampingFactor=.07; this.controls.target.set(0,0,0); this.controls.minDistance=72; this.controls.maxDistance=210; this.controls.minPolarAngle=.34; this.controls.maxPolarAngle=1.25; this.controls.maxAzimuthAngle=Math.PI; this.controls.minAzimuthAngle=-Math.PI;
    this.mode="map"; this.npcs=[]; this.vehicles=[]; this.remotePlayers=new Map(); this.markers=[]; this.clickables=[]; this.moveTarget=null; this.streetLights=[]; this.dayHour=12; this.keys=new Set(); this.yaw=0; this.pitch=0; this.dragLook=null; this.lastTime=performance.now(); this.mapCamStart=this.mapCamera.position.clone();
    this.resizeObserver=new ResizeObserver(()=>this.resize()); this.resizeObserver.observe(this.container);
    this.bindMovement(); this.renderMap(); this.animate();
  }
  resize(){ const w=Math.max(1,this.container.clientWidth),h=Math.max(1,this.container.clientHeight); this.renderer.setSize(w,h,false); this.mapCamera.aspect=w/h; this.mapCamera.updateProjectionMatrix(); this.camera.aspect=w/h; this.camera.updateProjectionMatrix(); }
  clearRoot(){ while(this.root.children.length){this.root.remove(this.root.children[0]);} this.clickables=[]; this.floorMesh=null; this.npcs=[]; this.vehicles=[]; this.remotePlayers.clear(); this.gateDemoCar=null; this.gateArms=[]; }
  add(mesh){this.root.add(mesh);return mesh;}
  road(x1,z1,x2,z2,width=5,color=0x555b60){const dx=x2-x1,dz=z2-z1,len=Math.hypot(dx,dz);const r=this.add(box(len,.16,width,mat(color), (x1+x2)/2,.08,(z1+z2)/2));r.rotation.y=-Math.atan2(dz,dx);const stripe=this.add(box(len*.92,.025,.12,mat(0xe6ddbc),(x1+x2)/2,.17,(z1+z2)/2));stripe.rotation.y=r.rotation.y;return r;}
  path(points,width=3,color=0xcac8b9){for(let i=0;i<points.length-1;i++)this.road(points[i][0],points[i][1],points[i+1][0],points[i+1][1],width,color);}
  makeTree(x,z,scale=1){const g=new THREE.Group();g.position.set(x,0,z);g.add(box(.38*scale,2.1*scale,.38*scale,mat(0x765438),0,1.05*scale,0));const colors=[0x32784a,0x3e8950,0x5a9a5d];for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.IcosahedronGeometry((1.05-i*.12)*scale,1),mat(colors[i]));crown.position.set((i-1)*.36*scale,2.4*scale+(i%2)*.28*scale,0);crown.castShadow=true;g.add(crown);}this.add(g);}
  makeBuilding(place){
    const g=new THREE.Group();g.position.set(place.x,0,place.z);g.userData.place=place;
    const base=this.addTo(g,box(place.w+1,.45,place.d+1,mat(0xaeb3b6),0,.22,0));
    const floors=Math.max(1,Math.round(place.h/3));const body=this.addTo(g,box(place.w,place.h,place.d,mat(0xd7dadd),0,place.h/2+.45,0));
    // Slightly projecting roof slab and parapet create a compact low-poly campus building.
    this.addTo(g,box(place.w+.55,.42,place.d+.55,mat(0x9da5ab),0,place.h+.67,0));
    this.addTo(g,box(place.w*.65,.16,place.d*.62,mat(0xf2f3f3),0,place.h+.96,0));
    const glass=mat(0x527b92,.35),trim=mat(0xe8edf0,.6);
    const rows=Math.min(3,floors);
    for(let row=0;row<rows;row++){
      const y=1.4+row*2.2;
      const count=Math.max(2,Math.floor(place.w/2.4));
      for(let i=0;i<count;i++){
        const x=-place.w/2+.9+i*(place.w-1.8)/Math.max(1,count-1);
        this.addTo(g,box(.72,1.0,.09,glass,x,y,place.d/2+.055));
        this.addTo(g,box(.72,.07,.13,trim,x,y-.55,place.d/2+.07));
      }
      for(let i=0;i<Math.max(2,Math.floor(place.d/2.6));i++){
        const z=-place.d/2+.8+i*(place.d-1.6)/Math.max(1,Math.floor(place.d/2.6)-1);
        this.addTo(g,box(.09,1,.7,glass,place.w/2+.055,y,z));
      }
    }
    this.addTo(g,box(1.05,2,.14,mat(0x536b78),0,1.45,place.d/2+.08));
    // Tiny entrance canopy.
    this.addTo(g,box(2,.2,1.1,mat(0x718ba2),0,2.6,place.d/2+.55));
    // Landmark roof trim.
    if(place.category==="Academic") this.addTo(g,box(place.w*.25,.14,.35,mat(0x405e7f),0,place.h+1.2,0));
    this.add(g); this.clickable.push(g); return g;
  }
  addTo(group,mesh){group.add(mesh);return mesh;}
  makePitch(x,z,w,d){
    this.add(box(w,.12,d,mat(0x428750),x,.08,z));
    const line=mat(0xe7f0d9);const addLine=(a,b,c,e)=>{let dx=c-a,dz=e-b,len=Math.hypot(dx,dz),m=box(len,.025,.09,line,(a+c)/2,.16,(b+e)/2);m.rotation.y=-Math.atan2(dz,dx);this.add(m);};
    addLine(x-w/2+1,z-d/2+1,x+w/2-1,z-d/2+1);addLine(x+w/2-1,z-d/2+1,x+w/2-1,z+d/2-1);addLine(x+w/2-1,z+d/2-1,x-w/2+1,z+d/2-1);addLine(x-w/2+1,z+d/2-1,x-w/2+1,z-d/2+1);addLine(x,z-d/2+1,x,z+d/2-1);
    const circle=new THREE.Mesh(new THREE.TorusGeometry(2.8,.07,6,48),line);circle.rotation.x=Math.PI/2;circle.position.set(x,.19,z);this.add(circle);
  }
  makeHuman(x,z,scale=1,shirt=0x4f789b,gender="male"){
    // Campus students wear varied everyday outfits: tees, polos, hoodies,
    // jeans, skirts, sneakers and backpacks rather than plain stick figures.
    const g=new THREE.Group();
    const skin=mat([0x6f4635,0x89583f,0xa66d4e,0xb77b5b][Math.floor(Math.random()*4)]);
    const cloth=mat(shirt),pants=mat([0x26394e,0x35475a,0x4c4d54,0x6a5141,0x303c45][Math.floor(Math.random()*5)]);
    const shoe=mat([0x20252b,0xe4e3dc,0x8b4f3d][Math.floor(Math.random()*3)]);
    const hair=mat([0x211b18,0x30241e,0x17191d][Math.floor(Math.random()*3)]);
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.27*scale,.58*scale,4,8),cloth);torso.position.y=1.08*scale;torso.castShadow=true;g.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.22*scale,12,10),skin);head.position.y=1.67*scale;head.castShadow=true;g.add(head);
    const hairCap=new THREE.Mesh(new THREE.SphereGeometry(gender==="female"?.25*scale:.228*scale,12,8,0,Math.PI*2,0,Math.PI*.55),hair);hairCap.position.y=1.75*scale;g.add(hairCap);
    // Character silhouettes follow the supplied male/female full-body references.
    if(gender==="female"){
      const backHair=new THREE.Mesh(new THREE.CapsuleGeometry(.13*scale,.48*scale,4,8),hair);backHair.position.set(0,1.48*scale,-.16*scale);g.add(backHair);
      for(const side of [-1,1]){const lock=new THREE.Mesh(new THREE.CapsuleGeometry(.07*scale,.28*scale,3,6),hair);lock.position.set(side*.19*scale,1.53*scale,-.015);g.add(lock);}
    }else if(Math.random()>.7){const puff=new THREE.Mesh(new THREE.SphereGeometry(.12*scale,8,8),hair);puff.position.set(.17*scale,1.67*scale,-.02);g.add(puff);}
    const arms=[];
    for(const side of [-1,1]){
      const armPivot=new THREE.Group();armPivot.position.set(side*.29*scale,1.34*scale,0);
      const sleeve=new THREE.Mesh(new THREE.CapsuleGeometry(.095*scale,.32*scale,3,6),cloth);sleeve.rotation.z=side*-.18;sleeve.position.set(side*.035*scale,-.12*scale,0);armPivot.add(sleeve);
      const hand=new THREE.Mesh(new THREE.SphereGeometry(.075*scale,8,7),skin);hand.position.set(side*.07*scale,-.38*scale,.015);armPivot.add(hand);
      g.add(armPivot);arms.push(armPivot);
      const legPivot=new THREE.Group();legPivot.position.set(side*.13*scale,.62*scale,0);
      const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.105*scale,.39*scale,3,6),pants);leg.position.y=-.2*scale;legPivot.add(leg);
      const foot=box(.2*scale,.12*scale,.34*scale,shoe,0,-.46*scale,.07*scale);legPivot.add(foot);g.add(legPivot);
      if(!g.userData.legs)g.userData.legs=[];g.userData.legs.push(legPivot);
    }
    // Backpack straps and body on a random selection of students.
    if(Math.random()>.43){const bagMat=mat([0x293d55,0x754d3e,0x3f654e,0x6b557c][Math.floor(Math.random()*4)]);const bag=box(.48*scale,.55*scale,.22*scale,bagMat,0,1.1*scale,-.28*scale);g.add(bag);}
    // Occasional skirt outfit, with leggings/shoes, to vary the campus crowd.
    if(Math.random()>.82){const skirt=new THREE.Mesh(new THREE.CylinderGeometry(.24*scale,.34*scale,.35*scale,8),cloth);skirt.position.y=.73*scale;g.add(skirt);}
    g.position.set(x,0,z);g.userData.walk={x,z,phase:0,speed:0,radius:0,arms,legs:g.userData.legs};
    this.add(g);this.npcs.push(g);return g;
  }
  makeCar(x,z,color=0xd1a84d){
    const g=new THREE.Group();const paint=mat(color,.42),glass=mat(0x9fc4d4,.28),tire=mat(0x252b30),trim=mat(0xe3e6e8,.55);
    g.add(box(2.55,.68,1.3,paint,0,.64,0));g.add(box(1.42,.67,1.08,glass,0,1.24,-.04));
    g.add(box(.1,.42,.1,trim,-1.18,.78,.68));g.add(box(.1,.42,.1,trim,1.18,.78,.68));
    for(const a of [-.83,.83])for(const b of [-.74,.74]){const w=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.17,12),tire);w.rotation.z=Math.PI/2;w.position.set(a,.32,b);g.add(w);}
    for(const zSide of [-.43,.43]){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.18,.16,.06),mat(0xfff0c5));lamp.position.set(1.29,.65,zSide);g.add(lamp);}
    g.position.set(x,.08,z);g.userData.drive={progress:Math.random(),speed:.0085};this.add(g);this.vehicles.push(g);return g;
  }
  makeEntranceGate(){
    // Main gate inspired by the user's Baze entrance photo: two vehicle lanes,
    // substantial concrete pillars, a university sign and separate IN / OUT.
    const concrete=mat(0xd1d0c8),dark=mat(0x35424a),sign=mat(0xf0eee5),barrier=mat(0xe6e2d8);
    const pillar=(x)=>{this.add(box(1.25,5.4,1.25,concrete,x,2.7,51));this.add(box(1.55,.35,1.55,mat(0xb8b8b0),x,5.45,51));};
    pillar(1.2);pillar(14.8);
    this.add(box(12.4,.85,.75,concrete,8,5.05,51));
    this.add(box(8.4,.48,.12,sign,8,5.08,50.58));
    // Gatehouse sign lettering is rendered as a canvas texture.
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const ctx=canvas.getContext('2d');
    ctx.fillStyle='#f0eee5';ctx.fillRect(0,0,1024,128);ctx.fillStyle='#24384a';ctx.font='bold 66px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('BAZE UNIVERSITY',512,65);
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    const board=new THREE.Mesh(new THREE.PlaneGeometry(8.2,.48),new THREE.MeshBasicMaterial({map:tex}));board.position.set(8,5.08,50.49);this.add(board);
    // Security booths at the sides of the lanes.
    for(const x of [-4.5,21]){this.add(box(2.6,2.7,2.6,mat(0xe2e5e4),x,1.35,51));this.add(box(2.0,.9,.08,mat(0x75a1b5,.3),x,1.85,49.65));this.add(box(2.8,.2,2.8,mat(0x7c8790),x,2.75,51));}
    // Hinged automatic boom barriers: each arm swings sideways around its own post.
    this.gateArms=[];
    for(const x of [4.6,11.4]){
      this.add(box(.28,2.15,.28,dark,x,1.08,41.6));
      const pivot=new THREE.Group();pivot.position.set(x,2.12,48.6);
      const arm=box(4.2,.14,.16,barrier,2.0,0,0);pivot.add(arm);
      for(let i=0;i<5;i++)pivot.add(box(.34,.16,.2,mat(i%2?0xffffff:0xc94e45),.45+i*.72,.02,-.08));
      this.add(pivot);this.gateArms.push({pivot,open:0,target:0,lane:x===4.6?"in":"out"});
    }
    this.add(box(5,.06,1.1,mat(0x2e6d46),4.6,.16,55));
    this.add(box(5,.06,1.1,mat(0x9a4b43),11.4,.16,55));
    this.makeRoadLabel('ENTRY',4.6,55,0x276d45);this.makeRoadLabel('EXIT',11.4,55,0x9b4d43);
  }
  makeRoadLabel(label,x,z,color){
    const c=document.createElement('canvas');c.width=256;c.height=80;const ctx=c.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,256,80);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.font='bold 48px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,128,42);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(5,1.5),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(x,.22,z);this.add(m);
  }
  createTrafficRoute(){
    // Vehicles stay on the perimeter boulevard. The route is deliberately kept
    // outside every building and sports-ground footprint.
    const points=[[4.6,68],[4.6,58],[4.6,52],[4.6,48],[-12,57],[-42,57],[-68,54],[-76,32],[-76,0],[-76,-34],[-68,-62],[-35,-68],[0,-68],[38,-68],[70,-62],[76,-35],[76,0],[76,30],[66,52],[38,57],[18,57],[11.4,52],[11.4,58],[11.4,68]];
    this.trafficCurve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.08,z)),true,'centripetal');
    this.trafficLength=this.trafficCurve.getLength();
  }
  renderMap(){
    this.mode="map";this.isometricInterior=false;this.clearRoot();this.root.scale.setScalar(1.12);this.clickable=[];this.controls.enabled=true;
    this.scene.background.set(0x9cc9dd);this.scene.fog=new THREE.Fog(0x9cc9dd,130,240);
    // Broad campus land parcel and green belts.
    this.add(box(190,.8,178,mat(0x779b69),0,-.48,-2));
    this.add(box(185,.18,173,mat(0x91ad78),0,.0,-2));
    // Perimeter fence / tree belt.
    this.path([[-82,-76],[82,-76],[84,56],[36,64],[-72,62],[-84,20],[-82,-76]],1.5,0x64745e);
    // A perimeter boulevard keeps traffic clear of all building footprints.
    this.path([[-72,-62],[72,-62],[76,-44],[76,25],[66,53],[35,57],[-62,57],[-75,34],[-76,-35],[-72,-62]],6.4,0x535a5e);
    // Pedestrian-only campus paths; none are used by vehicles.
    this.path([[-48,-55],[-26,-55],[-4,-55],[20,-55],[45,-55],[65,-55]],2.5,0xc5c6b8);
    this.path([[-50,-3],[-27,-3],[-5,-3],[18,-3],[48,-3]],2.5,0xc5c6b8);
    this.path([[-50,34],[-27,34],[-4,34],[20,34],[48,34]],2.5,0xc5c6b8);
    this.path([[-48,-45],[-48,-20],[-48,5],[-48,33]],2.5,0xc5c6b8);
    this.path([[0,-45],[0,-20],[0,5],[0,34]],2.5,0xc5c6b8);
    this.path([[65,-45],[65,-20],[65,5],[65,34]],2.5,0xc5c6b8);
    // Sidewalk / paved central plaza.
    this.add(box(16,.12,9,mat(0xc6c5b9),-8,.15,18));
    this.add(box(14,.12,8,mat(0xc6c5b9),18,.15,18));
    // Football pitch and basketball court.
    this.makePitch(45,-41,27,18);
    this.add(box(12,.12,8,mat(0xb78c6c),-22,.14,30));
    // Reconstructed main entrance with distinct vehicle entry and exit lanes.
    this.makeEntranceGate();
    this.createTrafficRoute();
    this.path([[4.6,70],[4.6,58],[4.6,48],[-12,57],[-42,57],[-68,54],[-76,32],[-76,0],[-76,-34],[-68,-62],[-35,-68],[0,-68],[38,-68],[70,-62],[76,-35],[76,0],[76,30],[66,52],[38,57],[18,57],[11.4,48],[11.4,58],[11.4,70]],6.4,0x535a5e);
    // Green courtyards.
    for(const [x,z,w,d] of [[-8,-14,13,8],[5,-14,12,8],[25,2,12,7],[-31,8,9,8],[-8,7,10,8]]) this.add(box(w,.09,d,mat(0x82a979),x,.12,z));
    // Build locations as actual 3D objects. Sports stadium uses field geometry rather than a tall block.
    for(const place of LOCATIONS){
      if(place.type==="sports" && place.id==="football-stadium"){
        const g=new THREE.Group();g.position.set(place.x,0,place.z);g.userData.place=place;this.addTo(g,box(place.w,.12,place.d,mat(0x638b66),0,.1,0));
        const stands=this.addTo(g,box(place.w,.75,2.2,mat(0xb9c3c9),0,.45,place.d/2+1));this.add(g);this.clickable.push(g);continue;
      }
      this.makeBuilding(place);
    }
    // Walkways and landscaping between buildings.
    for(let i=0;i<78;i++){
      const x=-54+((i*37)%108),z=-38+((i*23)%76);
      if(Math.abs(x%22)<7 || Math.abs(z%19)<5) continue;
      this.makeTree(x,z,.65+((i%4)*.1));
    }
    // Campus lamps.
    this.streetLights=[];
    for(const [x,z] of [[-60,-35],[-30,-43],[0,-43],[30,-43],[60,-20],[66,20],[30,53],[-25,53],[-66,15],[-65,-25]]){
      const g=new THREE.Group();g.position.set(x,0,z);g.add(box(.16,4,.16,mat(0x454f58),0,2,0));const bulbMat=new THREE.MeshStandardMaterial({color:0xffedb0,emissive:0xffc85a,emissiveIntensity:0});const bulb=new THREE.Mesh(new THREE.SphereGeometry(.28,8,8),bulbMat);bulb.position.y=4.1;g.add(bulb);const light=new THREE.PointLight(0xffd58a,0,19,2);light.position.y=3.9;g.add(light);this.add(g);this.streetLights.push({light,bulb});
    }
    // Animated campus pedestrians and small cars.
    for(let i=0;i<13;i++){const x=-35+(i*13)%70,z=-20+(i*17)%53;this.makeHuman(x,z,.6,[0x4b7398,0x9d7656,0x6c8f70,0x9a6f91,0x456a73][i%5]);}
    for(let i=0;i<5;i++)this.makeCar(0,.08,[0xc4a04c,0xd9e0e5,0x5e7f9d,0x9d5c4c,0x4c7558][i%5]).userData.drive.progress=i/5;
    this.buildMarkers();this.resetMapCamera();this.setTime(this.dayHour);
  }
  buildMarkers(){
    this.markerLayer.innerHTML="";this.markers=[];
    for(const p of LOCATIONS){
      const b=document.createElement("button");b.className="map-marker";b.type="button";b.title="Enter "+p.name;b.innerHTML=`<span class="pin-dot"></span>${p.icon} ${p.name}`;
      b.addEventListener("click",()=>this.onSelect?.(p));this.markerLayer.appendChild(b);this.markers.push({place:p,element:b});
    }
  }
  resetMapCamera(){this.mapCamera.position.set(103,126,103);this.controls.target.set(0,0,0);this.controls.update();}
  addRoomLight(){this.scene.background.set(0xdce8ef);this.scene.fog=new THREE.Fog(0xdce8ef,35,90);}
  renderInterior(place,gender="male"){
    this.mode="interior";this.currentPlace=place;this.currentGender=gender;this.root.scale.setScalar(1);this.controls.enabled=false;this.clearRoot();this.markerLayer.innerHTML="";this.addRoomLight();
    if(place.type==="gate"){this.isometricInterior=false;this.renderGateScene();return;}
    const floorColor=place.type==="hostel"?(gender==="female"?0xcdbbd1:0xb9c9d8):0xc8b997;
    const wallColor=place.type==="hostel"?(gender==="female"?0xe8ddeb:0xdce7ef):0xe9e3d5;
    if(place.type==="hostel"){
      // 12.2 ft square bedroom with a 5.7 x 4.4 ft attached ensuite.
      const outline=new THREE.Shape();outline.moveTo(-6.1,-6.1);outline.lineTo(6.1,-6.1);outline.lineTo(6.1,5.2);outline.lineTo(11.8,5.2);outline.lineTo(11.8,9.6);outline.lineTo(6.1,9.6);outline.lineTo(6.1,6.1);outline.lineTo(-6.1,6.1);outline.closePath();
      const geometry=new THREE.ShapeGeometry(outline);geometry.rotateX(-Math.PI/2);
      this.floorMesh=new THREE.Mesh(geometry,mat(floorColor));this.floorMesh.position.y=-.14;this.floorMesh.receiveShadow=true;this.add(this.floorMesh);
      this.add(box(12.2,3.5,.25,mat(wallColor),0,1.75,-6.1));
      this.add(box(.25,3.5,12.2,mat(0xd2c6ad),-6.1,1.75,0));
      this.add(box(.25,3.5,12.2,mat(0xc9bda7),6.1,1.75,0));
      this.add(box(5.7,3.5,.25,mat(wallColor),8.95,1.75,-9.6));
      this.add(box(.25,3.5,4.4,mat(0xd2c6ad),11.8,1.75,-7.4));
      this.add(box(1.4,3.5,.25,mat(wallColor),6.8,1.75,-5.2));this.add(box(1.4,3.5,.25,mat(wallColor),10.4,1.75,-5.2));
      this.interiorTarget={x:2.2,z:-1.4};\n      for(const z of [-3.2,1.2]){this.add(box(.12,1.45,2.2,mat(0x83b4cd,.3),-5.96,2.2,z));this.add(box(.18,.12,2.3,mat(0x8b7e6b),-5.9,1.45,z));}
    }else{
      this.floorMesh=box(24,.25,24,mat(floorColor),0,-.14,0);this.add(this.floorMesh);
      this.add(box(24,3.5,.35,mat(wallColor),0,1.75,-11.8));
      this.add(box(.35,3.5,24,mat(0xd2c6ad),-12,1.75,0));this.add(box(.35,3.5,24,mat(0xc9bda7),12,1.75,0));
      this.interiorTarget={x:0,z:0};
    }
    // Windows and baseboards remain on the rear wall of non-hostel interiors.
    if(place.type!=="hostel"){
      for(const x of [-7,-2,3,8]){this.add(box(2.2,1.7,.12,mat(0x83b4cd,.3),x,2.5,-11.58));this.add(box(2.3,.12,.18,mat(0x8b7e6b),x,.95,-11.5));}
      this.add(box(24,.35,.25,mat(0x8b7c63),0,.12,-11.55));
    }
    const addBox=(w,h,d,c,x,y,z)=>this.add(box(w,h,d,mat(c),x,y,z));
    const type=place.type;
    if(type==="hostel"){
      // Shared hostel room: exactly two single beds, each with its own frame, mattress and pillow.
      for(const bedX of [-3.8,1.0]){
        const bed=new THREE.Group();bed.position.set(bedX,0,-3.2);bed.userData.isBed=true;
        bed.add(box(3.5,.48,4.5,mat(0x8c715c),0,.24,0));
        bed.add(box(3.28,.28,4.25,mat(gender==="female"?0xb77caa:0x557b9d),0,.62,0));
        bed.add(box(3.2,.18,.82,mat(0xe9e8df),0,.84,-1.8));
        bed.add(box(.95,.2,.72,mat(0xffffff),0,.86,-2.15));
        bed.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
        this.add(bed);this.clickables.push(bed);
      }
      // Blueprint-inspired ensuite toilet at the rear-right of the bedroom.
      addBox(5.7,.12,4.4,0xb9aaa0,8.95,.02,-7.4);
      addBox(.16,2.8,4.4,0xe1d9cf,6.1,1.4,-7.4);
      addBox(5.7,2.8,.16,0xe1d9cf,8.95,1.4,-9.55);
      addBox(1.1,.9,.85,0xeee9e2,10.45,.48,-7.4); // vanity
      addBox(.9,.08,.7,0x8db6c2,10.45,.96,-7.4); // basin
      addBox(.85,.5,1.1,0xf1f0eb,8.05,.35,-7.1); // toilet base
      addBox(.8,.5,.8,0xffffff,8.05,.72,-7.1); // toilet bowl
      addBox(1.2,1.6,.12,0x7c9aa4,11.2,1.6,-9.35); // shower panel
      addBox(3,.3,1.4,0x8a725a,3,.95,2);addBox(1.6,1.8,.18,0x658b9b,3,2,1.35);
      addBox(2.4,2.8,2.5,0xd9d7cf,4.0,1.4,2.8);
      addBox(.25,2.1,2.0,0x86a9b6,5.0,1.1,3.1);
      addBox(1.4,.12,1.4,0xb2a188,-4.2,.2,4.7);
      this.makeHuman(1,-2,.95,gender==="female"?0x9a658e:0x4d7190,gender);
    }else if(type==="classroom"||type==="library"){
      addBox(12,2.8,.35,0x263b4b,0,4.4,-11.45);addBox(2.2,.25,.45,0x6d5742,0,2.6,-10.8);
      addBox(2.5,.15,1.2,0x947c5d,0,1,-8.5);
      for(const z of [-6,-2,2,6])for(const x of [-7,-2.3,2.3,7]){
        addBox(2.1,.2,1.1,0x8b6947,x,.95,z);addBox(1.9,.12,.95,0xb88b5f,x,1.1,z);
        addBox(.18,.9,.2,0x6b5240,x-.8,.48,z-.3);addBox(.18,.9,.2,0x6b5240,x+.8,.48,z-.3);
      }
      this.makeHuman(-.5, -8,1,0x4a7297);
      // Staff offices are inside the academic blocks, not a separate building.
      addBox(4.8,2.5,.18,0xe5e9e7,8,1.35,-10.9);addBox(3.8,.2,1.6,0x80654b,8,1.1,-9.7);addBox(1.4,1.2,.12,0x66869a,8,2.7,-10.8);
      for(let i=0;i<6;i++)this.makeHuman(-7+(i%3)*6, -4+Math.floor(i/3)*6,.83,[0x557f9d,0x9e745c,0x778e65,0x9a7095][i%4]);
      if(place.id==="block-b"){
        // Block B contains three distinct teaching laboratories: Chemistry,
        // Physics and Biology. Each bay has its own colour-coded lab bench.
        const labNames=[['CHEMISTRY',-7,0x78a7b8],['PHYSICS',0,0xc39a65],['BIOLOGY',7,0x83a879]];
        labNames.forEach(([label,x,color])=>{
          addBox(6.5,.18,7.2,0x9a9b91,x,.18,2.4);
          addBox(5.7,.32,1.25,color,x,1.05,1.2);addBox(.16,1.1,.16,0x53616b,x-2.5,.55,1.2);addBox(.16,1.1,.16,0x53616b,x+2.5,.55,1.2);
          addBox(5.8,2.5,.16,0xe5e9e7,x,1.45,-1.2);
          const labelCanvas=document.createElement('canvas');labelCanvas.width=512;labelCanvas.height=128;const cx=labelCanvas.getContext('2d');cx.fillStyle='#24384a';cx.fillRect(0,0,512,128);cx.fillStyle='#ffffff';cx.font='bold 58px Arial';cx.textAlign='center';cx.textBaseline='middle';cx.fillText(label,256,66);const labelTex=new THREE.CanvasTexture(labelCanvas);labelTex.colorSpace=THREE.SRGBColorSpace;
          const panel=new THREE.Mesh(new THREE.PlaneGeometry(4.8,1.05),new THREE.MeshBasicMaterial({map:labelTex}));panel.position.set(x,3.05,-1.08);this.add(panel);
          if(label==='CHEMISTRY'){for(let j=0;j<3;j++){const flask=new THREE.Mesh(new THREE.CylinderGeometry(.16,.23,.55,8),mat(0x7bb8c9,.25));flask.position.set(x-1+j,1.52,1.2);this.add(flask);}}
          if(label==='PHYSICS'){for(let j=0;j<2;j++)addBox(.18,1.4,.18,0x56636d,x-1+j*2,1.75,1.2);}
          if(label==='BIOLOGY'){for(let j=0;j<3;j++){const dish=new THREE.Mesh(new THREE.CylinderGeometry(.22,.22,.08,12),mat(0x9fcf8c,.3));dish.position.set(x-1+j,1.28,1.2);this.add(dish);}}
          this.makeHuman(x,4.2,.72,[0x527d96,0x6b8660,0x9b715b][Math.round((x+7)/7)]);
        });
      }
      if(type==="library")for(let i=0;i<3;i++)addBox(1.1,4.5,2.0,0x806f58,-10+i*2,2,-3);
    }else if(type==="restaurant"){
      // Distinct dining room: front reception/cashier counter, tables, chairs,
      // pendant lights and uniformed waiters (not a classroom layout).
      addBox(14,1.25,1.8,0x8b6548,0,1.05,-9);addBox(14,.18,2,0xd6b58a,0,1.78,-9);
      addBox(2.2,1.8,.18,0x6f8794,-5,2.0,-10.0);addBox(2.4,.2,.22,0xe9eceb,-5,3.0,-10.0);
      const table=(x,z)=>{addBox(3.1,.18,2.3,0x8a6041,x,1.05,z);for(const dx of [-1.25,1.25])for(const dz of [-.75,.75])addBox(.16,.9,.16,0x57483d,x+dx,.5,z+dz);for(const [cx,cz] of [[-2.15,0],[2.15,0],[0,-1.8],[0,1.8]]){addBox(.85,.15,.85,0x9c7653,x+cx,.72,z+cz);addBox(.12,.7,.12,0x58483b,x+cx,.35,z+cz);}};
      for(const [x,z] of [[-6,-2],[0,-2],[6,-2],[-6,5],[0,5],[6,5]])table(x,z);
      for(const x of [-7,0,7]){const light=new THREE.PointLight(0xffdca8,.8,12);light.position.set(x,5,2);this.add(light);this.npcs.push(...[]);}
      // Waiters wear coordinated dark aprons over light shirts and move between tables.
      for(let i=0;i<3;i++){const waiter=this.makeHuman(-5+i*5,-7,.9,0xf0eee7);waiter.add(box(.38,.5,.08,mat(0x303942),0,.96,.24));waiter.userData.walk.speed=.35;waiter.userData.walk.radius=2.1;}
      const guests=[[-8.15,-2,Math.PI/2],[2.15,-2,-Math.PI/2],[-6,7,0],[6,3,Math.PI]];
      guests.forEach(([x,z,rot],i)=>{
        const guest=this.makeHuman(x,z,.82,[0x4d7a99,0xa57553,0x718c6a,0x9b7195][i]);
        guest.rotation.y=rot;
        guest.position.y=.12;
        guest.userData.legs?.forEach((leg,j)=>{leg.rotation.x=j===0?Math.PI/2:Math.PI/2;});
        guest.children.forEach(part=>{if(part.position?.y>1)part.position.y-=.22;});
        guest.userData.arms?.forEach(arm=>{arm.rotation.x=-.9;});
      });
    }else if(type==="sports"){
      addBox(18,.1,17,0x6b9a6a,0,0,0);for(const x of [-8,8])addBox(.12,.03,15,0xf0f0dd,x,.1,0);addBox(16,.03,.12,0xf0f0dd,0,.1,0);for(let i=0;i<4;i++)this.makeHuman(-6+i*4,-2+(i%2)*4,.85,[0x5c7e9e,0x9a715e,0x6f916b][i%3]);
    }else if(type==="medical"){
      addBox(8,1.4,2,0x91a8b9,0,1.1,-8);addBox(8,.15,2.1,0xe9f1f4,0,1.9,-8);addBox(2.2,3,.18,0x79a6ba,-5,2,-10.8);
      for(const x of [-5,0,5]){addBox(3,.35,5,0xf0f1ef,x,.65,1);addBox(2.7,.22,4.5,0xffffff,x,.95,1);}
      this.makeHuman(-1,-6,1,0x668aa3);
    }else{
      addBox(10,.35,2,0x8b755b,0,1.5,-8);for(let i=0;i<5;i++){const x=-8+i*4;addBox(2.1,.3,1.2,0x8e7256,x,.9,0);addBox(.18,1.6,.18,0x69513d,x-.8,.4,.35);addBox(.18,1.6,.18,0x69513d,x+.8,.4,.35);}for(let i=0;i<4;i++)this.makeHuman(-6+i*4,-4,.85,[0x5c7e9e,0x9a715e,0x6f916b][i%3]);
    }
    // Doorway opening / threshold is at the camera end of the room.
    addBox(3,.15,.5,0x746148,0,0,5.8);
    this.yaw=0;this.pitch=-.12;
    this.player=this.makeHuman(0,2.5,.98,gender==="female"?0x9a658e:0x4d7190,gender);
    this.npcs=this.npcs.filter(n=>n!==this.player);
    this.player.userData.isPlayer=true;
    this.player.position.set(0,0,2.5);
    this.player.userData.walk.legs.forEach(leg=>leg.rotation.x=0);
    this.isometricInterior=true;this.camera.position.set(20,23,25);
    this.updateThirdPersonCamera();
  }
  setRemotePlayers(players=[]){
     if(this.mode!=="interior"||!this.currentPlace)return;
     const active=new Set();
     for(const p of players){
       if(!p?.user_id||p.user_id===this.localUserId||p.location!==this.currentPlace.name)continue;
       active.add(p.user_id);
       let avatar=this.remotePlayers.get(p.user_id);
       if(!avatar){avatar=this.makeHuman(0,0,.98,p.gender==="female"?0x9a658e:0x4d7190,p.gender||"male");avatar.userData.remoteUserId=p.user_id;this.remotePlayers.set(p.user_id,avatar);}
       const x=Number.isFinite(Number(p.x))?Number(p.x):0;
       const z=Number.isFinite(Number(p.z))?Number(p.z):0;
       avatar.userData.remoteTarget=new THREE.Vector3(THREE.MathUtils.clamp(x,this.currentPlace.type==="hostel"?-5.8:-9.5,this.currentPlace.type==="hostel"?11.5:9.5),0,THREE.MathUtils.clamp(z,this.currentPlace.type==="hostel"?-9.4:-9.5,this.currentPlace.type==="hostel"?5.8:9.5));
       if(Number.isFinite(Number(p.rotation)))avatar.rotation.y=Number(p.rotation);
       avatar.visible=true;
     }
     for(const [id,avatar] of this.remotePlayers){if(!active.has(id)){this.root.remove(avatar);this.remotePlayers.delete(id);}}
  }
  updateThirdPersonCamera(){
    if(this.isometricInterior){const distance=31;const target=this.interiorTarget||{x:0,z:0};this.camera.position.set(target.x+Math.sin(this.yaw)*distance,24,target.z+Math.cos(this.yaw)*distance);this.camera.lookAt(target.x,0,target.z);return;}
    if(!this.player)return;
    const distance=7.5, height=3.4;
    const offset=new THREE.Vector3(Math.sin(this.yaw)*distance*Math.cos(this.pitch),height-this.pitch*4,Math.cos(this.yaw)*distance*Math.cos(this.pitch));
    this.camera.position.copy(this.player.position).add(offset);
    const look=this.player.position.clone().add(new THREE.Vector3(0,1.15,0));
    this.camera.lookAt(look);
  }
  playerCanMoveTo(x,z){
    if(this.currentPlace?.type==="hostel"){if(x < -5.8 || x > 11.5 || z < -9.4 || z > 5.8)return false;}else if(x < -10.2 || x > 10.2 || z < -10.2 || z > 10.2) return false;
    const blocks=[];
    if(this.currentPlace?.type==="hostel"){
      blocks.push([-3.8,-3.2,1.85,2.35],[1.0,-3.2,1.85,2.35],[8.95,-7.4,1.55,1.45],[3,4.6,1.3,.8],[4.1,5.35,.5,.5]);
    }else if(this.currentPlace?.type==="restaurant"){
      blocks.push([-6,-2,1.8,1.4],[0,-2,1.8,1.4],[6,-2,1.8,1.4],[-6,5,1.8,1.4],[0,5,1.8,1.4],[6,5,1.8,1.4],[0,-9,7.2,1.25]);
    }else if(["classroom","library"].includes(this.currentPlace?.type)){
      for(const z of [-6,-2,2,6])for(const x of [-7,-2.3,2.3,7])blocks.push([x,z,1.05,.72]);
      blocks.push([0,-10.8,6.2,.55],[8,-9.7,2.5,.8]);
    }else if(this.currentPlace?.type==="medical"){
      blocks.push([-5,1,1.7,2.6],[0,1,1.7,2.6],[5,1,1.7,2.6],[0,-8,4,.7]);
    }else if(this.currentPlace?.type==="social"||this.currentPlace?.type==="office"||this.currentPlace?.type==="shop"){
      for(const x of [-8,-4,0,4,8])blocks.push([x,0,.95,.8]);
      blocks.push([0,-8,5,.75]);
    }
    return !blocks.some(([cx,cz,rx,rz])=>Math.abs(x-cx)<rx&&Math.abs(z-cz)<rz);
  }
  playBedAction(action,duration=5000,onDone=()=>{}){
    if(this.mode!=="interior"){onDone();return;}
    if(this.bedAvatar){this.root.remove(this.bedAvatar);this.bedAvatar=null;}
    const bedPos=this.selectedBedPosition||new THREE.Vector3(-3.8,0,-3.2);const target=new THREE.Vector3(bedPos.x,0,bedPos.z+2.95);
    const start=this.player?this.player.position.clone():new THREE.Vector3(0,0,2.5);
    const walkStart=performance.now(),walkDuration=1800;
    const walkTick=()=>{
      const t=Math.min(1,(performance.now()-walkStart)/walkDuration);
      if(this.player){
        this.player.position.lerpVectors(start,target,t);
        this.player.rotation.y=Math.atan2(target.x-start.x,start.z-target.z);
        this.player.userData.legs?.forEach((leg,i)=>leg.rotation.x=Math.sin(t*18+i*Math.PI)*.28*(1-t));
        this.updateThirdPersonCamera();
      }
      if(t<1){requestAnimationFrame(walkTick);return;}
      if(this.player)this.player.visible=false;
      this.showBedRestPose(action,duration,onDone);
    };
    walkTick();
  }
  showBedRestPose(action,duration,onDone){
    const g=new THREE.Group();const skin=mat(0x9b684d),shirt=mat(this.currentGender==="female"?0x9b6b91:0x527b9b),trousers=mat(0x34465b),shoe=mat(0x252b30);
    const torso=new THREE.Mesh(new THREE.CapsuleGeometry(.28,.62,4,8),shirt);torso.rotation.z=Math.PI/2;torso.position.set(0,.9,0);g.add(torso);
    const head=new THREE.Mesh(new THREE.SphereGeometry(.23,12,10),skin);head.position.set(-.78,.92,0);g.add(head);
    const legs=new THREE.Mesh(new THREE.CapsuleGeometry(.14,.55,4,8),trousers);legs.rotation.z=Math.PI/2;legs.position.set(.72,.72,0);g.add(legs);
    const blanket=new THREE.Mesh(new THREE.BoxGeometry(1.65,.12,.85),mat(action==="sleep"?0x718da7:0x9caaaf));blanket.position.set(.25,1.02,0);g.add(blanket);
    g.position.set((this.selectedBedPosition||new THREE.Vector3(-3.8,0,-3.2)).x,.78,(this.selectedBedPosition||new THREE.Vector3(-3.8,0,-3.2)).z);g.rotation.y=.12;this.add(g);this.bedAvatar=g;
    const started=performance.now();const tick=()=>{if(!this.bedAvatar)return;const t=(performance.now()-started)/duration;g.position.y=.78+(action==="sleep"?Math.sin(t*Math.PI*8)*.025:0);if(t>=1){this.root.remove(g);this.bedAvatar=null;if(this.player){this.player.visible=true;this.player.position.set((this.selectedBedPosition||new THREE.Vector3(-3.8,0,-3.2)).x,0,(this.selectedBedPosition||new THREE.Vector3(-3.8,0,-3.2)).z+2.95);this.updateThirdPersonCamera();}onDone();}else setTimeout(tick,80);};tick();
  }
  setTime(hour){
    this.dayHour=hour;const night=hour<6.5||hour>=19.5;const dusk=hour>=17.5&&hour<19.5;const dawn=hour>=5.5&&hour<7.5;
    const ambientLevel=night?.38:dusk?.9:1.65;this.ambient.intensity=ambientLevel;
    this.sun.intensity=night?.08:dusk?1.0:3.1;
    const sky=night?0x101c32:dusk?0x9b8c91:dawn?0xb8c7d2:0x9cc9dd;
    this.scene.background.set(sky);this.scene.fog.color.set(sky);
    for(const l of this.streetLights||[]){l.light.intensity=night?1.8:dusk?.75:0;l.bulb.material.emissiveIntensity=night?1.5:dusk?.55:0;}
  }
  renderGateScene(){
    this.camera.position.set(0,1.65,12);this.yaw=0;this.pitch=-.04;this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");
    const concrete=mat(0xd8d9d7),dark=mat(0x35424a),white=mat(0xf1f2ef),red=mat(0xc94e45),road=mat(0x555b60);
    this.add(box(42,.25,48,road,0,-.15,-2));
    for(const x of [-10,10]){this.add(box(1.8,6,1.8,concrete,x,3,-8));this.add(box(2.1,.35,2.1,mat(0xb8bcbf),x,6.1,-8));}
    this.add(box(18,.9,1.0,concrete,0,5.5,-8));
    this.add(box(3.5,2.8,3.2,mat(0xe5e8e6),-14,1.4,-8));
    this.add(box(2.5,1,.12,mat(0x78a9bd,.3),-14,1.8,-9.65));
    this.gateArms=[];
    for(const x of [-4.5,4.5]){
      this.add(box(.3,2.1,.3,dark,x,1.05,-1));
      const pivot=new THREE.Group();pivot.position.set(x,2.05,-5);
      const arm=box(4.3,.16,.18,white,2.05,0,0);pivot.add(arm);
      for(let i=0;i<5;i++)pivot.add(box(.32,.17,.2,red,.5+i*.72,.02,-.08));
      this.add(pivot);this.gateArms.push({pivot,open:0,target:0,lane:x<0?"in":"out"});
    }
    this.gateDemoCar=this.makeCar(-4.5,.08,0x547c9d);this.gateDemoCar.position.set(-4.5,.08,18);this.gateDemoCar.rotation.y=Math.PI/2;this.gateDemoCar.userData.gateDemo={phase:0};
    this.add(box(5,.05,1.1,mat(0x2e6d46),-4.5,.02,4));this.add(box(5,.05,1.1,mat(0x9a4b43),4.5,.02,4));
  }
  bindMovement(){
    const canvas=this.renderer.domElement;
    const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
    let down=null;
    canvas.addEventListener("pointerdown",e=>{if(this.mode!=="interior")return;down={x:e.clientX,y:e.clientY};this.dragLook={x:e.clientX,y:e.clientY};});
    window.addEventListener("pointermove",e=>{if(this.mode!=="interior"||!this.dragLook)return;const dx=e.clientX-this.dragLook.x,dy=e.clientY-this.dragLook.y;this.dragLook={x:e.clientX,y:e.clientY};if(down&&(Math.abs(e.clientX-down.x)+Math.abs(e.clientY-down.y)>7))down.moved=true;this.yaw-=dx*.004;this.pitch=Math.max(-.65,Math.min(.55,this.pitch-dy*.003));this.camera.rotation.set(this.pitch,this.yaw,0,"YXZ");});
    window.addEventListener("pointerup",e=>{
      if(this.mode!=="interior")return;
      this.dragLook=null;
      if(!down)return;
      const click=down;down=null;
      if(click.moved)return;
      const rect=canvas.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,this.camera);
      const bedHits=raycaster.intersectObjects(this.clickables,true);
      if(bedHits.length){const bed=bedHits[0].object;let root=bed;while(root.parent&&root!==this.root&&!root.userData.isBed)root=root.parent;if(root.userData.isBed){this.selectedBedPosition=new THREE.Vector3(root.position.x,0,root.position.z);this.moveTarget=new THREE.Vector3(root.position.x,0,root.position.z+2.95);this.pendingBed=false;this.onBedSelect?.();return;}}
      if(this.floorMesh){const hits=raycaster.intersectObject(this.floorMesh,false);if(hits.length){const pt=hits[0].point;const x=THREE.MathUtils.clamp(pt.x,-9.5,9.5),z=THREE.MathUtils.clamp(pt.z,-9.5,9.5);this.moveTarget=new THREE.Vector3(x,0,z);this.pendingBed=false;}}
    });
  }
  move(direction){/* Keyboard movement intentionally disabled: tap the floor to walk. */}
  stopMove(direction){}
  zoom(delta){if(this.mode!=="map")return;this.mapCamera.position.add(this.mapCamera.position.clone().sub(this.controls.target).normalize().multiplyScalar(delta));this.controls.update();}
  updateMarkers(){if(this.mode!=="map")return;const w=this.container.clientWidth,h=this.container.clientHeight;for(const {place,element} of this.markers){const v=new THREE.Vector3(place.x*1.12,(place.h+2.5)*1.12,place.z*1.12).project(this.mapCamera);const x=(v.x*.5+.5)*w,y=(-v.y*.5+.5)*h;const visible=v.z<1&&v.z>-1&&x>-60&&x<w+60&&y>-40&&y<h+40;element.style.display=visible?"block":"none";element.style.left=x+"px";element.style.top=y+"px";}}
  animate=()=>{requestAnimationFrame(this.animate);const now=performance.now(),dt=Math.min(.05,(now-this.lastTime)/1000);this.lastTime=now;
    if(this.mode==="map"){
      this.controls.update();
      for(const npc of this.npcs){const w=npc.userData.walk;w.phase+=dt*w.speed;npc.position.x=w.x+Math.sin(w.phase)*w.radius;npc.position.z=w.z+Math.cos(w.phase*.7)*w.radius*.45;npc.rotation.y=Math.cos(w.phase)>=0?Math.PI/2:-Math.PI/2;w.legs?.forEach((leg,i)=>leg.rotation.x=Math.sin(w.phase*2+i*Math.PI)*.32);w.arms?.forEach((arm,i)=>arm.rotation.x=Math.sin(w.phase*2+i*Math.PI+Math.PI)*.22);}
      for(const car of this.vehicles){
        const d=car.userData.drive;d.progress=(d.progress+dt*d.speed)%1;
        const point=this.trafficCurve.getPointAt(d.progress),tangent=this.trafficCurve.getTangentAt(d.progress);
        car.position.set(point.x,.08,point.z);car.rotation.y=-Math.atan2(tangent.z,tangent.x);
      }
      // Open the entry/exit boom only while a car approaches or crosses it.
      for(const gate of (this.gateArms||[])){
        const laneX=gate.lane==="in"?4.6:11.4;
        const near=this.vehicles.some(car=>Math.abs(car.position.x-laneX)<3.3 && Math.abs(car.position.z-50.5)<8.5);
        gate.target=near?Math.PI/2:0;
        gate.open=THREE.MathUtils.damp(gate.open,gate.target,5.5,dt);
        gate.pivot.rotation.y=gate.open;
      }
      this.updateMarkers();this.renderer.render(this.scene,this.mapCamera);
    }else{
      for(const avatar of this.remotePlayers.values()){if(avatar.userData.remoteTarget)avatar.position.lerp(avatar.userData.remoteTarget,.28);}
      if(this.moveTarget&&this.player&&this.player.visible){
        const delta=this.moveTarget.clone().sub(this.player.position);delta.y=0;const distance=delta.length();
        if(distance<.18){this.player.position.x=this.moveTarget.x;this.player.position.z=this.moveTarget.z;this.moveTarget=null;if(this.pendingBed){this.pendingBed=false;this.onBedSelect?.();}}
        else{delta.normalize().multiplyScalar(Math.min(distance,4.8*dt));const nx=this.player.position.x+delta.x,nz=this.player.position.z+delta.z;if(this.playerCanMoveTo(nx,this.player.position.z))this.player.position.x=nx;if(this.playerCanMoveTo(this.player.position.x,nz))this.player.position.z=nz;this.player.rotation.y=Math.atan2(delta.x,delta.z);this.player.userData.legs?.forEach((leg,i)=>leg.rotation.x=Math.sin(now*.012+i*Math.PI)*.32);this.player.userData.arms?.forEach((arm,i)=>arm.rotation.x=Math.sin(now*.012+i*Math.PI+Math.PI)*.22);}
      }
      this.updateThirdPersonCamera();
      if(this.gateDemoCar){
        const demo=this.gateDemoCar.userData.gateDemo;demo.phase=(demo.phase+dt*.16)%1;
        this.gateDemoCar.position.set(-4.5,.08,18-demo.phase*30);
        const near=demo.phase>.28&&demo.phase<.72;
        for(const gate of (this.gateArms||[])){gate.target=near?Math.PI/2:0;gate.open=THREE.MathUtils.damp(gate.open,gate.target,5.5,dt);gate.pivot.rotation.y=gate.open;}
      }
      this.renderer.render(this.scene,this.camera);
    }
  }
}
