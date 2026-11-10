import { createNewState, money, getDayName, clampNeed } from "./core/state.js";
import { addUser, findUser, passwordHash, savePlayer, loadPlayer } from "./core/storage.js";
import { LOCATIONS, getHostelForGender } from "./world/locations.js";
import { World3D } from "./world/world3d.js";
import { decayNeeds } from "./systems/needs.js";
import { renderFoodHTML, purchaseFood } from "./systems/restaurants.js";
import { doTaxiRide, doTutoring, doFreelance } from "./systems/jobs.js";
import { performActivity } from "./systems/activities.js";
import { bindPhone } from "./interface/phone.js";

const $=id=>document.getElementById(id);
let state=null,world=null,phone=null,toastTimer=null,tickTimer=null;
let mapWasOpen=false;

function toast(message){const el=$("toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2800);}
function setActivity(title,message){$("activity-title").textContent=title;$("activity-message").textContent=message;if(state)state.lastAction=message;}
function authMessage(message,isError=true){const el=$("auth-message");el.textContent=message;el.style.color=isError?"#b14e52":"#34764b";}
function switchAuth(mode){$("login-tab").classList.toggle("active",mode==="login");$("signup-tab").classList.toggle("active",mode==="signup");$("login-form-wrap").hidden=mode!=="login";$("signup-form-wrap").hidden=mode!=="signup";authMessage("");}
$("login-tab").addEventListener("click",()=>switchAuth("login"));$("signup-tab").addEventListener("click",()=>switchAuth("signup"));

async function handleSignup(event){event.preventDefault();const name=$("signup-name").value.trim(),username=$("signup-username").value.trim(),password=$("signup-password").value;const gender=document.querySelector('input[name="gender"]:checked')?.value||"male";
 if(username.length<3||!(/^[A-Za-z0-9_]+$/).test(username)){authMessage("Use at least 3 letters, numbers or underscores for the username.");return;}
 if(password.length<4){authMessage("Password must be at least 4 characters.");return;}
 if(findUser(username)){authMessage("That username is already taken.");return;}
 const user={name,username,gender,passwordHash:await passwordHash(password),createdAt:Date.now()};addUser(user);
 state=createNewState(user);savePlayer(state);startGame(user,state);}
async function handleLogin(event){event.preventDefault();const username=$("login-username").value.trim(),password=$("login-password").value;const user=findUser(username);if(!user){authMessage("We couldn't find that username.");return;}if(user.passwordHash!==await passwordHash(password)){authMessage("Incorrect password.");return;}const saved=loadPlayer(user.username);state=saved?{...createNewState(user),...saved,username:user.username,name:user.name,gender:user.gender}:{...createNewState(user)};startGame(user,state);}
$("signup-form").addEventListener("submit",handleSignup);$("login-form").addEventListener("submit",handleLogin);

function startGame(user,playerState){
 state=playerState;$("auth-screen").hidden=true;$("game-screen").hidden=false;
 $("profile-name").textContent=user.name;$("profile-avatar").textContent=user.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓";$("phone-student-name").textContent=user.name.split(" ")[0];
 const current=LOCATIONS.find(p=>p.name===state.location);if(!current)state.location=getHostelForGender(user.gender)==="female-hostel"?"Female Hostel":"Male Hostel";
 if(!world){world=new World3D($("world-canvas"),$("map-marker-layer"),place=>enterLocation(place));}
 else world.renderInterior(current||LOCATIONS.find(p=>p.name===state.location),state.gender);
 enterLocation(LOCATIONS.find(p=>p.name===state.location)||LOCATIONS.find(p=>p.id===getHostelForGender(user.gender)),true);
 renderActions();updateHUD();phone?.close();if(!phone)phone=bindPhone({onApp:handlePhoneApp});
 if(tickTimer)clearInterval(tickTimer);tickTimer=setInterval(gameTick,5000);
}
function logout(){if(state)savePlayer(state);if(phone)phone.close();$("game-screen").hidden=true;$("auth-screen").hidden=false;$("login-password").value="";switchAuth("login");if(tickTimer)clearInterval(tickTimer);}
$("logout-button").addEventListener("click",logout);

function updateHUD(){if(!state)return;world?.setTime(state.hour+state.minute/60);$("cash-display").textContent=money(state.cash);$("clock-display").textContent=`${getDayName(state.day)} · ${state.hour%12||12}:${String(state.minute).padStart(2,"0")} ${state.hour>=12?"PM":"AM"}`;$("phone-time").textContent=`${state.hour%12||12}:${String(state.minute).padStart(2,"0")}`;
 for(const key of ["hunger","energy","fun","social","hygiene","bladder"]){const value=clampNeed(state[key]);$(key+"-value").textContent=value+"%";$(key+"-bar").style.width=value+"%";$(key+"-bar").style.background=value<=20?"#c96f70":value<=45?"#d5a34d":"#6e9b79";}
 const rides=state.rides||0;$("goal-progress-bar").style.width=(rides/5*100)+"%";$("goal-progress-label").textContent=`${rides} / 5 ProTaxi rides`;$("goal-text").textContent=state.taxiBonusClaimed?"Daily ProTaxi goal complete — ₦10,000 bonus earned.":"Complete five ProTaxi rides for a ₦10,000 bonus.";
}
function updateSceneHeading(place){$("scene-title").textContent=place.name;$("scene-kicker").textContent=place.type.toUpperCase();$("scene-subtitle").textContent=sceneDescription(place);$("scene-chip").textContent=place.icon+" "+place.name;$("location-type").textContent=place.category.toUpperCase();}
function sceneDescription(place){const desc={hostel:"Your room — rest and take care of yourself.",classroom:"Lecture room — attend classes and work on your studies.",library:"Study, research and prepare for exams.",restaurant:"Choose a meal at the counter or sit with other students.",sports:"Exercise, play and have a break from lectures.",office:"University offices and student services.",medical:"Medical Centre — visit the campus health facility.",social:"Meet other students and spend time together.",gate:"The main entrance to Baze University.",shop:"Browse shops and student essentials."};return desc[place.type]||"Explore this campus location.";}
function enterLocation(place,silent=false){if(!place)return;if(state.location!==place.name){if(state.energy<3){toast("You're too tired to travel. Rest first.");return;}state.energy=Math.max(0,state.energy-3);advanceTime(5);}
 if(place.type==="hostel"&&place.gender&&place.gender!==state.gender){toast("This hostel is for its residents. Visit your own hostel instead.");return;}
 if(mapWasOpen){restoreWorldViewport();$("map-screen").hidden=true;mapWasOpen=false;}
 state.location=place.name;world.renderInterior(place,state.gender);$("map-marker-layer").hidden=true;$("map-controls").hidden=true;$("map-back-button").hidden=true;$("mobile-movement").hidden=false;updateSceneHeading(place);renderActions();updateHUD();if(!silent)setActivity("You entered "+place.name,sceneDescription(place));savePlayer(state);}
function openMap(){
 if(!world)return;
 mapWasOpen=true;
 world.renderMap();
 const screen=$("map-screen"),canvasHost=$("map-canvas"),overlay=$("map-marker-layer");
 screen.hidden=false;
 // Reuse the same WebGL renderer and marker layer; moving their containers keeps
 // the map crisp and avoids creating a second Three.js renderer.
 canvasHost.appendChild($("world-canvas"));
 overlay.hidden=false;
 overlay.classList.add("map-marker-layer-full");
 $("map-screen-body").appendChild(overlay);
 $("map-controls").hidden=true;
 $("map-back-button").hidden=true;
 $("mobile-movement").hidden=true;
 $("scene-chip").textContent="🗺️ Baze University campus map";
 $("scene-tip").textContent="Drag to rotate · Scroll to zoom · Select a location marker";
}
function restoreWorldViewport(){
 const overlay=$("map-marker-layer");
 $("scene-frame").appendChild($("world-canvas"));
 $("scene-frame").appendChild(overlay);
 overlay.classList.remove("map-marker-layer-full");
 overlay.hidden=true;
}
function closeMap(){
 if(!mapWasOpen)return;
 restoreWorldViewport();
 $("map-screen").hidden=true;
 const loc=LOCATIONS.find(p=>p.name===state.location)||LOCATIONS.find(p=>p.id===getHostelForGender(state.gender));
 world.renderInterior(loc,state.gender);
 $("mobile-movement").hidden=false;
 updateSceneHeading(loc);
 mapWasOpen=false;
}
$("open-map-button").addEventListener("click",openMap);
$("close-map").addEventListener("click",closeMap);
$("map-back-button").addEventListener("click",closeMap);
$("zoom-in").addEventListener("click",()=>world.zoom(-9));
$("zoom-out").addEventListener("click",()=>world.zoom(9));
$("map-reset").addEventListener("click",()=>world.resetMapCamera());
$("map-zoom-in").addEventListener("click",()=>world.zoom(-9));
$("map-zoom-out").addEventListener("click",()=>world.zoom(9));
$("map-reset-view").addEventListener("click",()=>world.resetMapCamera());

function renderActions(){const place=LOCATIONS.find(p=>p.name===state.location);const actions=[];if(place.type==="hostel"){actions.push(["😴 Sleep","sleep"],["🚿 Shower","shower"],["🚻 Use toilet","toilet"],["🛌 Rest","rest"]);}if(place.type==="classroom"||place.type==="library"){actions.push(["📖 Study","study"],["🔎 Research","research"],["🫂 Talk to students","social"]);}if(place.type==="restaurant"){actions.push(["🍴 View menu","food"],["🫂 Socialise","social"]);}if(place.type==="sports"){actions.push(["⚽ Play / exercise","exercise"],["🎉 Have fun","fun"],["😴 Rest","rest"]);}if(place.type==="social"){actions.push(["🫂 Socialise","social"],["🎮 Have fun","fun"],["😴 Rest","rest"]);}if(place.type==="office"||place.type==="medical"||place.type==="gate"||place.type==="shop"){actions.push(["🫂 Talk to students","social"],["📋 Check information","admin"]);}actions.push(["📱 Open phone","phone"]);const host=$("action-buttons");host.innerHTML="";for(const [label,key] of actions){const b=document.createElement("button");b.textContent=label;b.addEventListener("click",()=>key==="phone"?phone.open():key==="food"?openFood():runActivity(key));host.appendChild(b);}}
function advanceTime(minutes){let total=state.hour*60+state.minute+minutes;while(total>=1440){total-=1440;state.day++;state.rides=0;state.taxiBonusClaimed=false;}state.hour=Math.floor(total/60);state.minute=total%60;decayNeeds(state,minutes);}
function gameTick(){if(!state||$("game-screen").hidden)return;advanceTime(1);updateHUD();savePlayer(state);}
function runActivity(action){
 const finish=()=>{const result=performActivity(state,action);if(!result.ok){toast(result.message);return;}if(result.minutes)advanceTime(result.minutes);setActivity("Activity completed",result.message);toast(result.message);updateHUD();savePlayer(state);};
 const current=LOCATIONS.find(p=>p.name===state.location);
 if((action==="rest"||action==="sleep")&&current?.type==="hostel"){
   const buttons=$("action-buttons");buttons.querySelectorAll("button").forEach(b=>b.disabled=true);
   world?.playBedAction(action,5000,()=>{buttons.querySelectorAll("button").forEach(b=>b.disabled=false);finish();});
   setActivity(action==="sleep"?"Sleeping…":"Resting…", "Your character is lying down on the hostel bed.");return;
 }
 finish();
}

function openModal(title,html){$("modal-title").textContent=title;$("modal-content").innerHTML=html;$("modal-backdrop").hidden=false;}
function closeModal(){$("modal-backdrop").hidden=true;}
$("modal-close").addEventListener("click",closeModal);$("modal-backdrop").addEventListener("click",e=>{if(e.target===$("modal-backdrop"))closeModal();});
function openFood(){
 const place=LOCATIONS.find(p=>p.name===state.location);
 const restaurant=place?.type==="restaurant"?(place.restaurant||place.name):null;
 if(!restaurant){openModal("Food & restaurants",`<p class="empty-note">Visit Mama Wheels, Empty or 2:30 Fe Lu to view that restaurant's own menu.</p>`);return;}
 const now=state.hour*60+state.minute;
 if(now<480||now>1230){toast(`${restaurant} is closed. Food places open at 8:00 AM and close at 8:30 PM.`);return;}
 openModal(`${restaurant} · Menu`,renderFoodHTML(state,restaurant));
 $("modal-content").querySelectorAll("[data-buy-food]").forEach(btn=>btn.addEventListener("click",()=>{const r=purchaseFood(state,{restaurant:btn.dataset.restaurant,price:Number(btn.dataset.price),gain:Number(btn.dataset.gain),location:state.location});if(!r.ok){toast(r.message);return;}advanceTime(10);setActivity("Meal purchased",`${btn.dataset.name} from ${btn.dataset.restaurant}.`);closeModal();toast(`${btn.dataset.name} purchased.`);updateHUD();savePlayer(state);}));
}
function openJobs(){openModal("Jobs & side hustles",`<div class="modal-row"><div><b>🚕 ProTaxi driver</b><small>₦3,000 per ride · Five rides per day · Current: ${state.rides}/5</small></div><button id="job-taxi">Work</button></div><div class="modal-row"><div><b>📚 Tutoring</b><small>Earn ₦2,500 · Costs 15 energy</small></div><button id="job-tutor">Work</button></div><div class="modal-row"><div><b>💻 Freelancing</b><small>Earn ₦4,000 · Costs 20 energy</small></div><button id="job-freelance">Work</button></div>`);$("job-taxi").onclick=()=>runJob(doTaxiRide,30);$("job-tutor").onclick=()=>runJob(doTutoring,60);$("job-freelance").onclick=()=>runJob(doFreelance,90);}
function runJob(fn,minutes){const result=fn(state);if(!result.ok){toast(result.message);return;}advanceTime(minutes);closeModal();toast(result.message);setActivity("Work completed",result.message);updateHUD();savePlayer(state);}
function openActivities(){openModal("Activities",`<div class="modal-row"><div><b>📖 Study</b><small>Study in a class block or the Library</small></div><button data-action="study">Study</button></div><div class="modal-row"><div><b>🫂 Socialise</b><small>Improve social and fun</small></div><button data-action="social">Socialise</button></div><div class="modal-row"><div><b>🎉 Have fun</b><small>Improve fun; costs energy</small></div><button data-action="fun">Have fun</button></div><div class="modal-row"><div><b>😴 Rest</b><small>Recover 25 energy</small></div><button data-action="rest">Rest</button></div><div class="modal-row"><div><b>🏃 Exercise</b><small>Best done at Football Stadium</small></div><button data-action="exercise">Exercise</button></div>`);$("modal-content").querySelectorAll("[data-action]").forEach(b=>b.onclick=()=>{closeModal();runActivity(b.dataset.action);});}
function openProfile(){openModal("Student profile",`<div class="modal-row"><div><b>${state.name}</b><small>@${state.username} · ${state.gender} student</small></div><strong>${state.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓"}</strong></div><div class="modal-row"><div><b>Academic progress</b><small>${state.studyPoints} study points</small></div><strong>Level ${1+Math.floor(state.studyPoints/10)}</strong></div><div class="modal-row"><div><b>Reputation</b><small>Baze points</small></div><strong>${state.reputation}</strong></div><div class="modal-row"><div><b>Home</b><small>Your assigned accommodation</small></div><strong>${state.gender==="female"?"Female":"Male"} Hostel</strong></div>`);}
function openWallet(){openModal("Wallet",`<h2 style="font-size:28px;margin:5px 0 15px">${money(state.cash)}</h2><p class="empty-note">Starting balance: ₦100,000. Earn money through ProTaxi, tutoring and freelancing.</p>`);}
function handlePhoneApp(app){phone.close();switch(app){case"map":openMap();break;case"food":openFood();break;case"jobs":openJobs();break;case"activities":openActivities();break;case"social":runActivity("social");break;case"profile":openProfile();break;case"wallet":openWallet();break;case"home":enterLocation(LOCATIONS.find(p=>p.id===getHostelForGender(state.gender)));break;case"save":savePlayer(state);toast("Game saved on this device.");break;}}

$("phone-teaser-open").addEventListener("click",()=>phone?.open());
document.querySelectorAll("[data-quick]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.quick;if(a==="save"){savePlayer(state);toast("Game saved.");}if(a==="rest")runActivity("rest");if(a==="food")openFood();}));
document.querySelectorAll("[data-move]").forEach(b=>{const dir=b.dataset.move;b.addEventListener("pointerdown",e=>{e.preventDefault();world?.move(dir);});["pointerup","pointerleave","pointercancel"].forEach(ev=>b.addEventListener(ev,()=>world?.stopMove(dir)));});
window.addEventListener("beforeunload",()=>{if(state)savePlayer(state);});

// Provide a gentle first-run hint; the initial spawn is chosen from the gender selection.
