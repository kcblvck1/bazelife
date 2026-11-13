import { createNewState, money, getDayName, clampNeed, DEFAULT_APPEARANCE } from "./core/state.js";
import { addUser, findUser, getUsers, passwordHash, savePlayer, loadPlayer, loadLocalDirectMessages, sendLocalDirectMessage } from "./core/storage.js";
import { LOCATIONS, getHostelForGender } from "./world/locations.js";
import { World3D } from "./world/world3d.js";
import { decayNeeds } from "./systems/needs.js";
import { renderFoodHTML, purchaseFood } from "./systems/restaurants.js";
import { doTaxiRide, doTutoring, doFreelance } from "./systems/jobs.js";
import { performActivity } from "./systems/activities.js";
import { bindPhone } from "./interface/phone.js";
import { initMultiplayer, multiplayerEnabled, registerOnlineStudent, loginOnlineStudent, logoutOnlineStudent, handleEmailConfirmationRedirect, loadRecentMessages, sendCampusMessage, subscribeToCampus, updateOnlineLocation, searchRegisteredUsers, loadDirectMessages, loadDirectInbox, sendDirectMessage, publishPlayerPosition, saveOnlineGameSetup } from "./core/multiplayer.js";

const $=id=>document.getElementById(id);
let state=null,world=null,phone=null,toastTimer=null,tickTimer=null,onlineProfile=null,liveChannel=null,livePresence={};
let mapWasOpen=false,presenceTimer=null,directChatTarget=null,bazetalkUnread={},bazetalkLastRead={};
let onboardingSession=null;

const BAZE_UNIVERSITY_PROGRAMMES=[
 "B.Eng. Civil Engineering","B.Eng. Computer Engineering","B.Eng. Electrical & Electronics Engineering",
 "B.Eng. Mechanical Engineering","B.Eng. Petroleum & Gas Engineering","B.Eng. Telecommunications Engineering",
 "LL.B. Law","LL.B. Business Law","LL.B. Private & Public Law",
 "MBBS – Medicine and Surgery","B.Sc. Medical Laboratory Science (BMLS)","B.Sc. Public Health",
 "B.Sc. Radiography & Radiation Science",
 "B.Sc. Accounting","B.Sc. Banking & Finance","B.Sc. Business Management","B.Sc. Economics",
 "B.Sc. Government & Public Administration","B.Sc. Insurance & Actuarial Science",
 "B.Sc. International Relations & Diplomacy","B.Sc. Marketing","B.Sc. Mass Communication",
 "B.Sc. Psychology","B.Sc. Sociology",
 "B.Sc. Biological Sciences","B.Sc. Biotechnology","B.Sc. Communication Technology",
 "B.Sc. Computer Science","B.Sc. Computing for Business","B.Sc. Financial Mathematics",
 "B.Sc. Information Systems Management","B.Sc. Information Technology","B.Sc. Microbiology",
 "B.Sc. Petroleum Chemistry","B.Sc. Physics with Computing","B.Sc. Software Engineering",
 "B.Sc. Architecture","B.Sc. Building","B.Sc. Estate Management","B.Sc. Quantity Surveying",
 "B.Sc. Surveying & Geoinformatics","B.Sc. Urban & Regional Planning",
 "B.Sc. Human Anatomy","B.Sc. Human Physiology",
 "MBA – Master of Business Administration","LL.M – Master of Laws",
 "M.Sc. Accounting","M.Sc. Animal & Environmental Science","M.Sc. Chemistry",
 "M.Sc. Computer Science","M.Sc. Economics","M.Sc. International Relations & Diplomacy",
 "M.Sc. Management","M.Sc. Mass Communication","M.Sc. Parasitology",
 "M.Sc. Public Administration","M.Sc. Sociology"
];
const APPEARANCE_CHOICES={
 skinTone:{label:"Skin tone",swatches:true,options:[["Deep","#6f4635"],["Rich brown","#89583f"],["Warm brown","#a66d4e"],["Golden brown","#b77b5b"]]},
 hairStyle:{label:"Hairstyle",options:[["Low cut","lowcut"],["Afro","afro"],["Braids","braids"],["Locs","locs"]]},
 hairColor:{label:"Hair colour",swatches:true,options:[["Black","#211b18"],["Dark brown","#30241e"],["Soft black","#17191d"]]},
 topStyle:{label:"Top / shirt",options:[["Campus tee","tshirt"],["Polo","polo"],["Hoodie","hoodie"],["Button-up","buttonup"]]},
 topColor:{label:"Top colour",swatches:true,options:[["Navy blue","#4d7190"],["Burgundy","#813f55"],["Forest green","#416b58"],["Cream","#d5c9b1"],["Black","#292d33"]]},
 bottomStyle:{label:"Bottom wear",options:[["Trousers","trousers"],["Skirt","skirt"]]},
 bottomColor:{label:"Bottom colour",swatches:true,options:[["Deep navy","#26394e"],["Charcoal","#35414c"],["Brown","#6a5141"],["Black","#25272b"]]},
 shoeColor:{label:"Footwear",swatches:true,options:[["Black","#20252b"],["White","#e4e3dc"],["Tan","#8b4f3d"]]}
};
const FATE_STEPS=[
 {key:"course",title:"Which programme will you study?",description:"Randomly selected from the undergraduate and postgraduate programmes listed in your supplied Baze University PDF.",icon:"🎓",options:BAZE_UNIVERSITY_PROGRAMMES},
 {key:"level",title:"What level will you enter?",description:"Your university level is selected randomly. Undergraduate levels run from 100 to 500; postgraduate programmes use postgraduate year 1 or 2.",icon:"📚",options:["100 Level","200 Level","300 Level","400 Level","500 Level"]},
 {key:"background",title:"What is your financial background?",description:"Your background decides your opening wallet and, for Amnesty students, the recurring school allowance.",icon:"💳",options:["Nepo Baby","Middle Class","Amnesty Student"]}
];

function toast(message){const el=$("toast");el.textContent=message;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2800);}
function setActivity(title,message){$("activity-title").textContent=title;$("activity-message").textContent=message;if(state)state.lastAction=message;}
function authMessage(message,isError=true){const el=$("auth-message");el.textContent=message;el.style.color=isError?"#b14e52":"#34764b";}
const backendReady = await initMultiplayer();
$("backend-status").textContent = backendReady.enabled ? "Online mode ready: create an account with an email to play across devices." : "Local mode: " + backendReady.reason + " Existing local accounts still work on this browser.";
function switchAuth(mode){$("login-tab").classList.toggle("active",mode==="login");$("signup-tab").classList.toggle("active",mode==="signup");$("login-form-wrap").hidden=mode!=="login";$("signup-form-wrap").hidden=mode!=="signup";authMessage("");}

function renderAppearanceControls(){
 const host=$("appearance-controls");
 host.innerHTML=Object.entries(APPEARANCE_CHOICES).map(([key,group])=>`
  <div class="appearance-group">
   <h3>${group.label}</h3>
   <div class="appearance-options">
    ${group.options.map(([label,value])=>{
      const selected=onboardingSession?.appearance?.[key]===value;
      return `<button type="button" class="appearance-option ${selected?"selected":""}" data-appearance-choice data-key="${key}" data-value="${value}" aria-pressed="${selected}">
       ${group.swatches?`<span class="appearance-swatch" style="--swatch:${value}"></span>`:""}${label}
      </button>`;
    }).join("")}
   </div>
  </div>`).join("");
}
function renderAvatarPreview(){
 if(!onboardingSession)return;
 const appearance=onboardingSession.appearance,preview=$("avatar-preview");
 for(const [key,cssVar] of [["skinTone","--skin"],["hairColor","--hair"],["topColor","--top"],["bottomColor","--bottom"],["shoeColor","--shoe"]])preview.style.setProperty(cssVar,appearance[key]);
 preview.dataset.hair=appearance.hairStyle;preview.dataset.top=appearance.topStyle;preview.dataset.bottom=appearance.bottomStyle;
 $("avatar-gender-label").textContent=onboardingSession.user.gender==="female"?"FEMALE STUDENT":"MALE STUDENT";
 const top=APPEARANCE_CHOICES.topStyle.options.find(x=>x[1]===appearance.topStyle)?.[0]||"Campus tee";
 const bottom=APPEARANCE_CHOICES.bottomStyle.options.find(x=>x[1]===appearance.bottomStyle)?.[0]||"Trousers";
 const hair=APPEARANCE_CHOICES.hairStyle.options.find(x=>x[1]===appearance.hairStyle)?.[0]||"Low cut";
 $("avatar-outfit-name").textContent=top+" · "+bottom+" · "+hair;
}
function beginOnboarding(user,playerState){
 $("onboarding-student-label").textContent=user.name+" · customise your student avatar";
 onboardingSession={user,playerState,appearance:{...DEFAULT_APPEARANCE,...(playerState.appearance||{})},step:0,results:{},spinning:false};
 playerState.onboardingComplete=false;playerState.appearance={...onboardingSession.appearance};savePlayer(playerState);
 $("auth-screen").hidden=true;$("game-screen").hidden=true;$("onboarding-screen").hidden=false;
 $("customization-stage").hidden=false;$("fate-stage").hidden=true;$("onboarding-error").textContent="";
 renderAppearanceControls();renderAvatarPreview();
}
function secureRandomIndex(length){
 if(window.crypto?.getRandomValues){const n=new Uint32Array(1);window.crypto.getRandomValues(n);return n[0]%length;}
 return Math.floor(Math.random()*length);
}
function fateOptions(step){
 if(step.key!=="level")return step.options;
 const selectedCourse=onboardingSession?.results?.course||"";
 return /^(MBA|LL\.M|M\.Sc\.)/.test(selectedCourse)?["Postgraduate Year 1","Postgraduate Year 2"]:step.options;
}
function renderFateStage(){
 if(!onboardingSession)return;
 const step=FATE_STEPS[onboardingSession.step],result=onboardingSession.results[step.key];
 if(step.key==="level"){
  $("fate-step-description").textContent=fateOptions(step).some(value=>value.startsWith("Postgraduate"))
   ?"Your postgraduate year is selected randomly. The available options are postgraduate year 1 or 2."
   :"Your undergraduate level is selected randomly from 100 to 500.";
 }
 $("fate-step-eyebrow").textContent=`SPIN ${onboardingSession.step+1} OF 3`;
 $("fate-step-title").textContent=step.title;
 $("fate-step-description").textContent=step.description;
 $("fate-wheel-icon").textContent=step.icon;
 $("fate-wheel-value").textContent=result||"Ready?";
 $("fate-wheel-subtitle").textContent=result?"Your fate has been selected":"The wheel is waiting for you";
 $("fate-spin-status").textContent=result?"Result locked in. Continue when you're ready.":"Your result will be locked after the spin.";
 $("fate-spin-button").hidden=Boolean(result);
 $("fate-spin-button").disabled=false;
 $("fate-spin-button").textContent=onboardingSession.step===0?"🎡 Spin for my course":onboardingSession.step===1?"🎡 Spin for my level":"🎡 Spin for my background";
 $("fate-next-button").hidden=!result;
 $("fate-next-button").textContent=onboardingSession.step===2?"Complete my student story →":"Continue to next spin →";
 $("fate-result-summary").hidden=true;
 for(let i=1;i<=3;i++){
  const node=$("fate-progress-"+i);
  node.classList.toggle("active",i===onboardingSession.step+1);
  node.classList.toggle("done",i<onboardingSession.step+1);
 }
}
async function spinFate(){
 if(!onboardingSession||onboardingSession.spinning)return;
 const step=FATE_STEPS[onboardingSession.step];
 if(onboardingSession.results[step.key])return;
 onboardingSession.spinning=true;
 const spinButton=$("fate-spin-button"),wheel=$("fate-wheel"),value=$("fate-wheel-value");
 spinButton.disabled=true;wheel.classList.add("spinning");value.classList.add("rolling");
 $("fate-spin-status").textContent="Spinning… fate is being decided.";
 const options=fateOptions(step);
 const winner=options[secureRandomIndex(options.length)];
 const ticker=window.setInterval(()=>{value.textContent=options[secureRandomIndex(options.length)];},70);
 await new Promise(resolve=>window.setTimeout(resolve,2400));
 window.clearInterval(ticker);wheel.classList.remove("spinning");value.classList.remove("rolling");
 onboardingSession.results[step.key]=winner;onboardingSession.spinning=false;
 value.textContent=winner;$("fate-wheel-subtitle").textContent="Selected for your student profile";
 $("fate-spin-status").textContent="Locked in. Your result has been decided.";
 spinButton.hidden=true;$("fate-next-button").hidden=false;
 if(onboardingSession.step===2){
  for(let i=1;i<=3;i++)$("fate-progress-"+i).classList.add("done");
  $("fate-result-summary").hidden=false;
  $("fate-result-summary").innerHTML=[
   ["COURSE",onboardingSession.results.course],
   ["LEVEL",onboardingSession.results.level],
   ["BACKGROUND",onboardingSession.results.background]
  ].map(([label,text])=>`<div class="fate-result-item"><small>${label}</small><b>${text}</b></div>`).join("");
  $("fate-next-button").textContent="Start my Baze Life →";
 }
}
async function completeOnboarding(){
 if(!onboardingSession)return;
 const {user,playerState,appearance,results}=onboardingSession;
 if(!results.course||!results.level||!results.background)return;
 const background=results.background==="Nepo Baby"?"nepo":results.background==="Amnesty Student"?"amnesty":"middle";
 const initialCash=background==="nepo"?500000:100000;
 const nextAllowanceDay=background==="amnesty"?(Number(playerState.day)||1)+90:null;
 const setup={
  onboardingComplete:true,appearance:{...appearance},course:results.course,level:results.level,
  studentBackground:background,cash:initialCash,nextAmnestyAllowanceDay:nextAllowanceDay
 };
 $("fate-next-button").disabled=true;$("onboarding-error").textContent="Saving your student profile…";
 try{
  if(onlineProfile?.id){
   await saveOnlineGameSetup(setup);
   onlineProfile.gameSetup=setup;onlineProfile.appearance={...appearance};onlineProfile.onboardingRequired=false;
  }
  Object.assign(playerState,setup);savePlayer(playerState);
  onboardingSession=null;$("onboarding-screen").hidden=true;
  startGame(user,playerState);
  setActivity("Your fate has been decided",`${results.level} · ${results.course} · ${results.background}. Your student life starts now.`);
  toast(background==="amnesty"?"Welcome! Your ₦300,000 school allowance arrives every 90 in-game days.":`Welcome to Baze Life — you start with ${money(initialCash)}.`);
 }catch(error){
  $("onboarding-error").textContent=error.message||"Your student profile could not be saved. Please try again.";
  $("fate-next-button").disabled=false;
 }
}
function bindOnboarding(){
 $("onboarding-screen").addEventListener("click",event=>{
  const choice=event.target.closest("[data-appearance-choice]");
  if(choice&&onboardingSession){
   const key=choice.dataset.key,value=choice.dataset.value;
   if(!APPEARANCE_CHOICES[key]?.options.some(option=>option[1]===value))return;
   onboardingSession.appearance[key]=value;
   onboardingSession.playerState.appearance={...onboardingSession.appearance};
   renderAppearanceControls();renderAvatarPreview();return;
  }
 });
 $("customize-continue").addEventListener("click",()=>{
  if(!onboardingSession)return;
  onboardingSession.playerState.appearance={...onboardingSession.appearance};
  $("customization-stage").hidden=true;$("fate-stage").hidden=false;
  onboardingSession.step=0;renderFateStage();
 });
 $("fate-spin-button").addEventListener("click",spinFate);
 $("fate-next-button").addEventListener("click",()=>{
  if(!onboardingSession)return;
  if(onboardingSession.step<2){onboardingSession.step++;renderFateStage();}
  else completeOnboarding();
 });
}
bindOnboarding();

// After Supabase processes a confirmation link, show the login form rather than
// automatically starting the game. The student must sign in with their password.
if (backendReady.enabled) {
  try {
    const confirmation = await handleEmailConfirmationRedirect();
    if (confirmation) {
      switchAuth("login");
      authMessage(confirmation.message, !confirmation.ok);
    }
  } catch (error) {
    switchAuth("login");
    authMessage(error.message || "Email confirmation could not be completed.");
  }
}
$("login-tab").addEventListener("click",()=>switchAuth("login"));$("signup-tab").addEventListener("click",()=>switchAuth("signup"));

async function handleSignup(event){
 event.preventDefault();
 const name=$("signup-name").value.trim(),username=$("signup-username").value.trim(),password=$("signup-password").value;
 const gender=document.querySelector('input[name="gender"]:checked')?.value||"male";
 if(username.length<3||!(/^[A-Za-z0-9_]+$/).test(username)){authMessage("Use at least 3 letters, numbers or underscores for the username.");return;}
 if(password.length<6&&multiplayerEnabled()){authMessage("Password must be at least 6 characters for online accounts.");return;}
 if(password.length<4){authMessage("Password must be at least 4 characters for local accounts.");return;}
 const email=$("signup-email").value.trim();
 if(multiplayerEnabled()){
  if(!email){authMessage("Enter an email address to create an online student account.");return;}
  try{
   const result=await registerOnlineStudent({email,password,name,username,gender});
   if(!result.session){authMessage("Check your email to confirm your account, then log in with your email and password.",false);return;}
   const profile=result.profile||{};
   const user={id:result.user.id,email,name:profile.display_name||name,username:profile.username||username,gender:profile.gender||gender,onboardingRequired:true};
   onlineProfile=user;state=createNewState(user);savePlayer(state);beginOnboarding(user,state);return;
  }catch(error){authMessage(error.message||"Online sign-up failed.");return;}
 }
 if(findUser(username)){authMessage("That username is already taken.");return;}
 const user={name,username,gender,passwordHash:await passwordHash(password),createdAt:Date.now()};
 addUser(user);state=createNewState(user);savePlayer(state);beginOnboarding(user,state);
}
async function handleLogin(event){
 event.preventDefault();
 const username=$("login-username").value.trim(),password=$("login-password").value;
 if(multiplayerEnabled()&&username.includes("@")){
  try{
   const user=await loginOnlineStudent(username,password);onlineProfile=user;
   const saved=loadPlayer(user.username),base=createNewState(user);
   if(user.gameSetup)Object.assign(base,user.gameSetup);
   state=saved?{...base,...saved,username:user.username,name:user.name,gender:user.gender}:{...base};
   // Accounts created before the onboarding feature keep their existing game.
   if(saved&&saved.onboardingComplete===undefined&&!user.onboardingRequired&&!user.gameSetup)state.onboardingComplete=true;
   if(!user.onboardingRequired&&!user.gameSetup&&!saved)state.onboardingComplete=true;
   if(state.onboardingComplete){startGame(user,state);}
   else{beginOnboarding(user,state);}
   return;
  }catch(error){authMessage(error.message||"Online login failed.");return;}
 }
 const user=findUser(username);
 if(!user){authMessage(multiplayerEnabled()?"For online accounts, enter your email address. For local accounts, enter your username.":"We couldn't find that username.");return;}
 if(user.passwordHash!==await passwordHash(password)){authMessage("Incorrect password.");return;}
 onlineProfile=null;
 const saved=loadPlayer(user.username);
 state=saved?{...createNewState(user),...saved,username:user.username,name:user.name,gender:user.gender,onboardingComplete:saved.onboardingComplete!==false}:{...createNewState(user),onboardingComplete:true};
 if(state.onboardingComplete)startGame(user,state);else beginOnboarding(user,state);
}
$("signup-form").addEventListener("submit",handleSignup);$("login-form").addEventListener("submit",handleLogin);

function startGame(user,playerState){
 state=playerState;
 $("onboarding-screen").hidden=true;
 if(onlineProfile?.id){try{bazetalkUnread=JSON.parse(localStorage.getItem("bazetalk-unread:"+onlineProfile.id)||"{}")||{};bazetalkLastRead=JSON.parse(localStorage.getItem("bazetalk-lastread:"+onlineProfile.id)||"{}")||{};}catch{bazetalkUnread={};bazetalkLastRead={};}}else{bazetalkUnread={};bazetalkLastRead={};}
 updateBazeTalkBadge();
 $("auth-screen").hidden=true;$("game-screen").hidden=false;
 $("profile-name").textContent=user.name;$("profile-avatar").textContent=user.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓";$("phone-student-name").textContent=user.name.split(" ")[0];
 const current=LOCATIONS.find(p=>p.name===state.location);if(!current)state.location=getHostelForGender(user.gender)==="female-hostel"?"Female Hostel":"Male Hostel";
 if(!world){world=new World3D($("world-canvas"),$("map-marker-layer"),place=>enterLocation(place),()=>openBedOptions(),action=>openFixtureOptions(action));}
 else world.renderInterior(current||LOCATIONS.find(p=>p.name===state.location),state.gender,state.appearance);
 enterLocation(LOCATIONS.find(p=>p.name===state.location)||LOCATIONS.find(p=>p.id===getHostelForGender(user.gender)),true);
 renderActions();updateHUD();phone?.close();if(!phone)phone=bindPhone({onApp:handlePhoneApp});
 if(tickTimer)clearInterval(tickTimer);tickTimer=setInterval(gameTick,5000);
 if(onlineProfile?.id) connectCampusCommunity();
}
async function logout(){if(state)savePlayer(state);if(presenceTimer){clearInterval(presenceTimer);presenceTimer=null;}if(liveChannel){try{await liveChannel.untrack();}catch{}liveChannel=null;}if(onlineProfile)await logoutOnlineStudent();onlineProfile=null;livePresence={};if(phone)phone.close();$("game-screen").hidden=true;$("auth-screen").hidden=false;$("login-password").value="";switchAuth("login");if(tickTimer)clearInterval(tickTimer);}
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
 state.location=place.name;if(onlineProfile?.id)updateOnlineLocation(onlineProfile,place.name).then(()=>publishPlayerPosition(onlineProfile,place.name,world?.player?.position?{x:world.player.position.x,z:world.player.position.z,rotation:world.player.rotation.y}:null)).catch(error=>console.warn("Could not update online location.",error));world.renderInterior(place,state.gender,state.appearance);world.localUserId=onlineProfile?.id||null;refreshRemotePlayers();$("map-marker-layer").hidden=true;$("map-controls").hidden=true;$("map-back-button").hidden=true;$("mobile-movement").hidden=true;updateSceneHeading(place);renderActions();updateHUD();if(!silent)setActivity("You entered "+place.name,sceneDescription(place));savePlayer(state);}
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
 world.renderInterior(loc,state.gender,state.appearance);
 $("mobile-movement").hidden=true;
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

function renderActions(){const place=LOCATIONS.find(p=>p.name===state.location);const actions=[];if(place.type==="hostel"){actions.push(["😴 Sleep","sleep"],["🛌 Rest","rest"]);}if(place.type==="classroom"||place.type==="library"){actions.push(["📖 Study","study"],["🔎 Research","research"],["🫂 Talk to students","social"]);}if(place.type==="restaurant"){actions.push(["🍴 View menu","food"],["🫂 Socialise","social"]);}if(place.type==="sports"){actions.push(["⚽ Play / exercise","exercise"],["🎉 Have fun","fun"],["😴 Rest","rest"]);}if(place.type==="social"){actions.push(["🫂 Socialise","social"],["🎮 Have fun","fun"],["😴 Rest","rest"]);}if(place.type==="office"||place.type==="medical"||place.type==="gate"||place.type==="shop"){actions.push(["🫂 Talk to students","social"],["📋 Check information","admin"]);}actions.push(["📱 Open phone","phone"]);const host=$("action-buttons");host.innerHTML="";for(const [label,key] of actions){const b=document.createElement("button");b.textContent=label;b.addEventListener("click",()=>key==="phone"?phone.open():key==="food"?openFood():runActivity(key));host.appendChild(b);}}
function advanceTime(minutes){
 let total=state.hour*60+state.minute+minutes;
 while(total>=1440){
  total-=1440;state.day++;state.rides=0;state.taxiBonusClaimed=false;
  if(state.studentBackground==="amnesty"&&state.nextAmnestyAllowanceDay&&state.day>=state.nextAmnestyAllowanceDay){
   state.cash=(Number(state.cash)||0)+300000;
   state.nextAmnestyAllowanceDay+=90;
   toast("Amnesty allowance received: ₦300,000 from Baze University.");
  }
 }
 state.hour=Math.floor(total/60);state.minute=total%60;decayNeeds(state,minutes);
}
function gameTick(){if(!state||$("game-screen").hidden)return;advanceTime(1);updateHUD();savePlayer(state);}
function openBedOptions(){
 if(LOCATIONS.find(p=>p.name===state.location)?.type!=="hostel")return;
 openModal("What would you like to do?",`<p class="empty-note">Choose an action for the bed.</p><div class="bed-choice-actions"><button id="bed-rest">🛌 Rest <small>5 seconds</small></button><button id="bed-sleep">😴 Sleep <small>10 seconds</small></button></div>`);
 $("bed-rest").onclick=()=>{closeModal();runActivity("rest");};
 $("bed-sleep").onclick=()=>{closeModal();runActivity("sleep");};
}
function openFixtureOptions(action){
 if(LOCATIONS.find(p=>p.name===state.location)?.type!=="hostel")return;
 const toilet=action==="toilet";
 openModal(toilet?"Use the toilet":"Take a shower",toilet
  ?`<p class="empty-note">Walk into the ensuite, sit down and use the toilet for 3 seconds.</p><div class="bed-choice-actions"><button id="fixture-confirm">🚻 Use the toilet <small>3 seconds</small></button></div>`
  :`<p class="empty-note">Walk into the ensuite and shower for 7 seconds.</p><div class="bed-choice-actions"><button id="fixture-confirm">🚿 Shower <small>7 seconds</small></button></div>`);
 $("fixture-confirm").onclick=()=>{closeModal();runFixtureAction(action);};
}
function runFixtureAction(action){
 const duration=action==="toilet"?3000:7000;
 const buttons=$("action-buttons");buttons.querySelectorAll("button").forEach(b=>b.disabled=true);
 $("open-map-button").disabled=true;$("open-phone-button").disabled=true;
 world?.playFixtureAction(action,duration,()=>{
   buttons.querySelectorAll("button").forEach(b=>b.disabled=false);
   $("open-map-button").disabled=false;$("open-phone-button").disabled=false;
   const result=performActivity(state,action);
   if(!result.ok){toast(result.message);return;}
   if(result.minutes)advanceTime(result.minutes);
   setActivity(action==="toilet"?"Bathroom break":"Shower completed",result.message);
   toast(result.message);updateHUD();savePlayer(state);
 });
 setActivity(action==="toilet"?"Using the toilet…":"Showering…",action==="toilet"?"Your character is walking into the bathroom.":"Your character is walking to the bathtub.");
}

function runActivity(action){
 const finish=()=>{const result=performActivity(state,action);if(!result.ok){toast(result.message);return;}if(result.minutes)advanceTime(result.minutes);setActivity("Activity completed",result.message);toast(result.message);updateHUD();savePlayer(state);};
 const current=LOCATIONS.find(p=>p.name===state.location);
 if((action==="rest"||action==="sleep")&&current?.type==="hostel"){
   const buttons=$("action-buttons");buttons.querySelectorAll("button").forEach(b=>b.disabled=true);
   $("open-map-button").disabled=true;$("open-phone-button").disabled=true;
   world?.playBedAction(action,action==="sleep"?10000:5000,()=>{buttons.querySelectorAll("button").forEach(b=>b.disabled=false);$("open-map-button").disabled=false;$("open-phone-button").disabled=false;finish();});
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
function refreshRemotePlayers(){
 if(!world||world.mode!=="interior"||!state||!onlineProfile?.id)return;
 const players=Object.values(livePresence||{}).flat();
 const sameLocation=players.filter(player=>player?.user_id!==onlineProfile.id&&player?.location===state.location);
 world.localUserId=onlineProfile.id;
 world.setRemotePlayers(sameLocation);
}
async function connectCampusCommunity(){
 try{
  liveChannel=await subscribeToCampus(onlineProfile,state.location,presence=>{
   livePresence=presence;
   refreshRemotePlayers();
  },message=>{
   if($("modal-title")?.textContent==="T Social"){const stream=$("campus-chat-stream");if(stream){stream.insertAdjacentHTML("beforeend",chatMessageHTML(message));stream.scrollTop=stream.scrollHeight;}}
  },message=>{
   handleIncomingDirectMessage(message).catch(error=>console.warn("BazeTalk incoming message handler failed.",error));
  },status=>{
   if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)){
    console.warn("Supabase Realtime status:",status);
   }
  });
  refreshRemotePlayers();
  if(presenceTimer)clearInterval(presenceTimer);
  // Send compact movement snapshots through Broadcast. Presence stays static
  // until the player changes buildings, avoiding channel shutdown rate limits.
  presenceTimer=setInterval(()=>{
   if(!onlineProfile?.id||!state||!world?.player||world.mode!=="interior")return;
   publishPlayerPosition(onlineProfile,state.location,{x:world.player.position.x,z:world.player.position.z,rotation:world.player.rotation.y}).catch(error=>console.warn("Player position broadcast failed.",error));
  },300);
 }catch(error){
  console.error("Campus realtime connection failed.",error);
  toast("Multiplayer connection failed: "+(error.message||"Check your connection."));
 }
}
function chatMessageHTML(message){return `<div class="modal-row"><div><b>@${escapeHTML(message.sender_username||"student")}</b><small>${escapeHTML(message.body||"")}</small></div><small>${new Date(message.created_at||Date.now()).toLocaleTimeString()}</small></div>`;}
async function openSocial(){
 if(multiplayerEnabled()&&onlineProfile?.id){
  openModal("T Social",`<p class="empty-note">Search registered students by username to start a private conversation.</p>
   <form id="user-search-form" class="campus-chat-form"><input id="user-search-input" maxlength="18" placeholder="Search by username…" autocomplete="off" required><button class="primary" type="submit">Search</button></form>
   <div id="online-student-list"></div><hr><h3>Campus chat</h3><div id="campus-chat-stream" class="campus-chat-stream"></div>
   <form id="campus-chat-form" class="campus-chat-form"><input id="campus-chat-input" maxlength="500" placeholder="Message the campus…" required><button class="primary" type="submit">Send</button></form>`);
  try{
   const messages=await loadRecentMessages();
   const onlineIds=new Set(Object.values(livePresence).flat().map(p=>p.user_id));
   $("online-student-list").innerHTML=`<p class="empty-note">Enter a registered username above. Search results will appear here.</p>`;
   $("campus-chat-stream").innerHTML=messages.map(chatMessageHTML).join("")||`<p class="empty-note">No campus messages yet.</p>`;
   $("campus-chat-stream").scrollTop=$("campus-chat-stream").scrollHeight;
   $("campus-chat-form").onsubmit=async e=>{e.preventDefault();const input=$("campus-chat-input"),body=input.value.trim();if(!body)return;try{await sendCampusMessage(onlineProfile,body);input.value="";}catch(error){toast(error.message||"Message could not be sent.");}};
   $("user-search-form").onsubmit=async e=>{
    e.preventDefault();const query=$("user-search-input").value.trim();if(query.length<2){toast("Enter at least 2 characters of a username.");return;}
    const target=$("online-student-list");target.innerHTML=`<p class="empty-note">Searching registered users…</p>`;
    try{const found=await searchRegisteredUsers(query,onlineProfile.id);target.innerHTML=found.length?found.map(u=>socialUserRowHTML(u,onlineIds.has(u.id))).join(""):`<p class="empty-note">No registered users match “${escapeHTML(query)}”.</p>`;bindSocialUserRows();}
    catch(error){target.innerHTML=`<p class="empty-note">${escapeHTML(error.message)}</p>`;}
   };
   bindSocialUserRows();
  }catch(error){$("online-student-list").innerHTML=`<p class="empty-note">Could not load the online community: ${escapeHTML(error.message)}</p>`;}
  return;
 }
 openModal("T Social",`<p class="empty-note">Search registered students by username to start a private conversation. Local accounts are available on this browser; online accounts can message across devices when signed in.</p>
  <form id="user-search-form" class="campus-chat-form"><input id="user-search-input" maxlength="18" placeholder="Search by username…" autocomplete="off" required><button class="primary" type="submit">Search</button></form>
  <div id="online-student-list"><p class="empty-note">Enter a username above. Matching registered users will appear here.</p></div>`);
 $("user-search-form").onsubmit=e=>{
  e.preventDefault();const query=$("user-search-input").value.trim().replace(/^@/,"");
  if(query.length<2){toast("Enter at least 2 characters of a username.");return;}
  const found=getUsers().filter(u=>u.username.toLowerCase()!==state.username.toLowerCase()&&u.username.toLowerCase().includes(query.toLowerCase())).slice(0,20);
  const target=$("online-student-list");
  target.innerHTML=found.length?found.map(localSocialUserRowHTML).join(""):`<p class="empty-note">No local registered users match “${escapeHTML(query)}”. For cross-device users, sign in with an online account.</p>`;
  bindLocalSocialUserRows();
 };
}
function localSocialUserRowHTML(user){
 return `<div class="social-profile-row"><div class="social-avatar">${user.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓"}</div><div class="social-profile-info"><b>${escapeHTML(user.name)}</b><small>@${escapeHTML(user.username)} · ${user.gender} · This browser</small></div><button type="button" data-local-message="${escapeHTML(user.username)}">Message</button></div>`;
}
function bindLocalSocialUserRows(){
 $("online-student-list").querySelectorAll("[data-local-message]").forEach(button=>button.onclick=()=>{
  const username=button.dataset.localMessage;const user=getUsers().find(u=>u.username.toLowerCase()===username.toLowerCase());
  if(user)openLocalDirectConversation(user);else toast("That local student profile could not be found.");
 });
}
function renderLocalDirectMessages(user){
 const stream=$("direct-message-stream");if(!stream)return;
 const messages=loadLocalDirectMessages(state.username,user.username);
 stream.innerHTML=messages.map(message=>`<div class="modal-row"><div><b>${message.sender_username.toLowerCase()===state.username.toLowerCase()?"You":"@"+escapeHTML(user.username)}</b><small>${escapeHTML(message.body)}</small></div><small>${new Date(message.created_at).toLocaleTimeString()}</small></div>`).join("")||`<p class="empty-note">No messages yet. Say hello to @${escapeHTML(user.username)}.</p>`;
 stream.scrollTop=stream.scrollHeight;
}
function openLocalDirectConversation(user){
 openModal(`Message @${user.username}`,`<p class="empty-note">Private conversation · local browser account</p><div id="direct-message-stream" class="campus-chat-stream"></div><form id="direct-message-form" class="campus-chat-form"><input id="direct-message-input" maxlength="500" placeholder="Write a private message…" required><button class="primary" type="submit">Send</button></form>`);
 renderLocalDirectMessages(user);
 $("direct-message-form").onsubmit=e=>{
  e.preventDefault();const input=$("direct-message-input"),body=input.value.trim();if(!body)return;
  try{sendLocalDirectMessage(state.username,user.username,body);input.value="";renderLocalDirectMessages(user);}
  catch(error){toast(error.message||"Private message could not be saved.");}
 };
}

function socialUserRowHTML(u,isOnline=false){
 return `<div class="social-profile-row"><div class="social-avatar">${u.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓"}</div><div class="social-profile-info"><b>${escapeHTML(u.display_name)}</b><small>@${escapeHTML(u.username)} · ${escapeHTML(u.location||"Campus")}</small></div><span class="presence-dot ${isOnline?"online":"offline"}">${isOnline?"Online":"Offline"}</span><button type="button" data-message-user="${escapeHTML(u.id)}">Message</button></div>`;
}
function bindSocialUserRows(){
 $("modal-content").querySelectorAll("[data-message-user]").forEach(button=>button.onclick=async()=>{
  try{const userId=button.dataset.messageUser;const query=button.closest(".social-profile-row").querySelector(".social-profile-info small").textContent.split("@")[1].split(" ·")[0];const found=await searchRegisteredUsers(query,onlineProfile.id);const user=found.find(p=>p.id===userId);if(user)openDirectConversation(user);else toast("Could not open that student profile.");}
  catch(error){toast(error.message||"Could not open conversation.");}
 });
}
async function openDirectConversation(user){
 directChatTarget=user;
 openModal(`Message @${user.username}`,`<div id="direct-message-stream" class="campus-chat-stream"></div><form id="direct-message-form" class="campus-chat-form"><input id="direct-message-input" maxlength="500" placeholder="Write a private message…" required><button class="primary" type="submit">Send</button></form>`);
 await refreshDirectConversation(user,false);
 $("direct-message-form").onsubmit=async e=>{
  e.preventDefault();const input=$("direct-message-input"),body=input.value.trim();if(!body)return;
  try{await sendDirectMessage(onlineProfile,user.id,body);input.value="";await refreshDirectConversation(user,true);}
  catch(error){toast(error.message||"Private message could not be sent.");}
 };
}
async function refreshDirectConversation(user,keepScroll=false){
 const stream=$("direct-message-stream");if(!stream||!onlineProfile?.id)return;
 const wasAtBottom=stream.scrollHeight-stream.scrollTop-stream.clientHeight<50;
 const messages=await loadDirectMessages(onlineProfile.id,user.id);
 stream.innerHTML=messages.map(m=>`<div class="modal-row"><div><b>${m.sender_id===onlineProfile.id?"You":"@"+escapeHTML(user.username)}</b><small>${escapeHTML(m.body)}</small></div><small>${new Date(m.created_at).toLocaleTimeString()}</small></div>`).join("")||`<p class="empty-note">No messages yet. Say hello to @${escapeHTML(user.username)}.</p>`;
 if(!keepScroll||wasAtBottom)stream.scrollTop=stream.scrollHeight;
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function unreadCountFor(userId){return (bazetalkUnread[userId]||[]).length;}
function unreadTotal(){return Object.values(bazetalkUnread).reduce((sum,ids)=>sum+(Array.isArray(ids)?ids.length:0),0);}
function persistBazeTalkUnread(){
 if(!onlineProfile?.id)return;
 try{localStorage.setItem("bazetalk-unread:"+onlineProfile.id,JSON.stringify(bazetalkUnread));}catch(error){console.warn("Could not save BazeTalk unread state.",error);}
}
function persistBazeTalkLastRead(){
 if(!onlineProfile?.id)return;
 try{localStorage.setItem("bazetalk-lastread:"+onlineProfile.id,JSON.stringify(bazetalkLastRead));}catch(error){console.warn("Could not save BazeTalk read state.",error);}
}
function updateBazeTalkBadge(){
 const count=unreadTotal(),badge=$("bazetalk-app-badge");
 if(!badge)return;badge.textContent=count>99?"99+":String(count);badge.hidden=count===0;
}
function markBazeTalkRead(userId){
 if(!userId)return;
 delete bazetalkUnread[userId];bazetalkLastRead[userId]=Date.now();
 persistBazeTalkUnread();persistBazeTalkLastRead();updateBazeTalkBadge();
}
function bazetalkAvatar(user){
 return user?.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓";
}
function openBazeTalk(){
 if(!multiplayerEnabled()||!onlineProfile?.id){
   phone?.close();openModal("BazeTalk",`<p class="empty-note">BazeTalk needs an online student account. Sign in with your email to message students across devices.</p>`);return;
 }
 phone?.open();
 $("phone-home").hidden=true;$("bazetalk-view").hidden=false;
 $("bazetalk-inbox-view").hidden=false;$("bazetalk-conversation").hidden=true;
 $("bazetalk-search-results").innerHTML="";$("bazetalk-search-form").hidden=true;
 directChatTarget=null;
 if("Notification" in window && Notification.permission==="default"){
   try{Notification.requestPermission().catch(()=>{});}catch{}
 }
 $("bazetalk-back").onclick=()=>{
   $("bazetalk-view").hidden=true;$("phone-home").hidden=false;directChatTarget=null;
 };
 $("bazetalk-search-toggle").onclick=()=>{
   const form=$("bazetalk-search-form");form.hidden=!form.hidden;
   if(!form.hidden)$("bazetalk-search-input").focus();
   else $("bazetalk-search-results").innerHTML="";
 };
 $("bazetalk-chat-back").onclick=()=>{
   $("bazetalk-conversation").hidden=true;$("bazetalk-inbox-view").hidden=false;directChatTarget=null;refreshBazeTalkInbox().catch(console.warn);
 };
 $("bazetalk-search-form").onsubmit=async event=>{
   event.preventDefault();const query=$("bazetalk-search-input").value.trim();
   if(query.replace(/^@/,"").length<2){toast("Enter at least 2 characters of a username.");return;}
   const target=$("bazetalk-search-results");target.innerHTML=`<p class="bazetalk-empty">Searching students…</p>`;
   try{
     const found=await searchRegisteredUsers(query,onlineProfile.id);
     if(!found.length){target.innerHTML=`<p class="bazetalk-empty">No students match that username.</p>`;return;}
     target.innerHTML=found.map(user=>`<button type="button" class="bazetalk-contact" data-search-user="${escapeHTML(user.id)}"><span class="bazetalk-avatar">${bazetalkAvatar(user)}</span><span class="bazetalk-contact-copy"><b>${escapeHTML(user.display_name||user.username)}</b><small>@${escapeHTML(user.username)} · ${escapeHTML(user.location||"Baze campus")}</small></span><span class="bazetalk-contact-meta">Message</span></button>`).join("");
     target.querySelectorAll("[data-search-user]").forEach(button=>button.onclick=()=>{const user=found.find(item=>item.id===button.dataset.searchUser);if(user)openBazeTalkConversation(user).catch(error=>toast(error.message||"Could not open chat."));});
   }catch(error){target.innerHTML=`<p class="bazetalk-empty">${escapeHTML(error.message||"Student search failed.")}</p>`;}
 };
 $("direct-message-form").onsubmit=async event=>{
   event.preventDefault();const input=$("direct-message-input"),body=input.value.trim(),user=directChatTarget;
   if(!body||!user)return;
   const sendButton=$("direct-message-form").querySelector("button");sendButton.disabled=true;
   try{
     await sendDirectMessage(onlineProfile,user.id,body);input.value="";
     await refreshBazeTalkConversation(user,true);await refreshBazeTalkInbox();
   }catch(error){toast(error.message||"Message could not be sent.");}
   finally{sendButton.disabled=false;input.focus();}
 };
 refreshBazeTalkInbox().catch(error=>{$("bazetalk-contact-list").innerHTML=`<p class="bazetalk-empty">${escapeHTML(error.message||"Could not load messages.")}</p>`;});
}
async function refreshBazeTalkInbox(){
 if(!onlineProfile?.id||$("bazetalk-view").hidden)return;
 const host=$("bazetalk-contact-list");
 const conversations=await loadDirectInbox(onlineProfile.id);
 if(!conversations.length){host.innerHTML=`<p class="bazetalk-empty">No conversations yet. Tap “＋ New” to find a student and start chatting.</p>`;return;}
 host.innerHTML=conversations.map(({user,lastMessage,messages=[]})=>{
   const lastRead=Number(bazetalkLastRead[user.id]||0);
   const unseenIds=messages.filter(message=>message.sender_id!==onlineProfile.id&&Date.parse(message.created_at||0)>lastRead).map(message=>message.id);
   if(unseenIds.length){bazetalkUnread[user.id]=[...new Set([...(bazetalkUnread[user.id]||[]),...unseenIds])];}
   const unread=unreadCountFor(user.id),body=String(lastMessage?.body||"").slice(0,48);
   const time=lastMessage?.created_at?new Date(lastMessage.created_at).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"";
   return `<button type="button" class="bazetalk-contact" data-contact-id="${escapeHTML(user.id)}">
     <span class="bazetalk-avatar">${bazetalkAvatar(user)}</span>
     <span class="bazetalk-contact-copy"><b>${escapeHTML(user.display_name||user.username)}</b><small>${lastMessage?.sender_id===onlineProfile.id?"You: ":""}${escapeHTML(body)}</small></span>
     <span class="bazetalk-contact-meta">${time}${unread?`<span class="bazetalk-unread">${unread>99?"99+":unread}</span>`:""}</span>
   </button>`;
 }).join("");
 persistBazeTalkUnread();updateBazeTalkBadge();
 host.querySelectorAll("[data-contact-id]").forEach(button=>{
   button.onclick=()=>{
     const item=conversations.find(({user})=>user.id===button.dataset.contactId);
     if(item)openBazeTalkConversation(item.user).catch(error=>toast(error.message||"Could not open chat."));
   };
 });
}
async function openBazeTalkConversation(user){
 directChatTarget=user;markBazeTalkRead(user.id);
 $("bazetalk-inbox-view").hidden=true;$("bazetalk-conversation").hidden=false;
 $("bazetalk-chat-contact").innerHTML=`<b>${escapeHTML(user.display_name||user.username)}</b><small>@${escapeHTML(user.username)}</small>`;
 await refreshBazeTalkConversation(user,false);
 $("direct-message-input").focus();
}
async function refreshBazeTalkConversation(user,keepScroll=false){
 const stream=$("direct-message-stream");if(!stream||!onlineProfile?.id||!user?.id)return;
 const wasAtBottom=stream.scrollHeight-stream.scrollTop-stream.clientHeight<50;
 const messages=await loadDirectMessages(onlineProfile.id,user.id);
 stream.innerHTML=messages.map(message=>{
   const outgoing=message.sender_id===onlineProfile.id;
   const time=new Date(message.created_at||Date.now()).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
   return `<article class="bazetalk-message ${outgoing?"outgoing":""}"><p>${escapeHTML(message.body||"")}</p><time>${time}</time></article>`;
 }).join("")||`<p class="bazetalk-empty">No messages yet. Say hello to @${escapeHTML(user.username)}.</p>`;
 if(!keepScroll||wasAtBottom)stream.scrollTop=stream.scrollHeight;
}
async function handleIncomingDirectMessage(message){
 if(!message?.id||message.recipient_id!==onlineProfile?.id||message.sender_id===onlineProfile.id)return;
 const conversationOpen=!$("bazetalk-view").hidden&&!$("bazetalk-conversation").hidden&&directChatTarget?.id===message.sender_id;
 if(conversationOpen)markBazeTalkRead(message.sender_id);
 else{
   const ids=bazetalkUnread[message.sender_id]||[];
   if(!ids.includes(message.id)){bazetalkUnread[message.sender_id]=[...ids,message.id];persistBazeTalkUnread();updateBazeTalkBadge();}
 }
 let senderName="student",senderProfile=null;
 try{const inbox=await loadDirectInbox(onlineProfile.id);senderProfile=inbox.find(item=>item.user.id===message.sender_id)?.user;senderName=senderProfile?.username||senderName;}catch{}
 toast(`New BazeTalk message from @${senderName}`);
 if("Notification" in window && Notification.permission==="granted"){
   try{
     const notice=new Notification("BazeTalk · New message",{body:`@${senderName}: ${String(message.body||"").slice(0,110)}`,tag:"bazetalk-"+message.id});
     notice.onclick=()=>{window.focus();openBazeTalk();if(senderProfile)openBazeTalkConversation(senderProfile).catch(console.warn);};
   }catch(error){console.warn("Browser notification could not be shown.",error);}
 }
 if(!$("bazetalk-view").hidden){
   await refreshBazeTalkInbox();
   if(conversationOpen&&directChatTarget)await refreshBazeTalkConversation(directChatTarget,true);
 }
}
function openProfile(){
 const backgroundLabel=state.studentBackground==="nepo"?"Nepo Baby":state.studentBackground==="amnesty"?"Amnesty Student":"Middle Class";
 const allowance=state.studentBackground==="amnesty"?`<div class="modal-row"><div><b>School allowance</b><small>₦300,000 every 90 in-game days · Next payment: Day ${state.nextAmnestyAllowanceDay}</small></div><strong>₦300k</strong></div>`:"";
 openModal("Student profile",`<div class="modal-row"><div><b>${state.name}</b><small>@${state.username} · ${state.gender} student</small></div><strong>${state.gender==="female"?"👩🏽‍🎓":"👨🏽‍🎓"}</strong></div><div class="modal-row"><div><b>Course</b><small>${state.course||"Not selected"}</small></div><strong>🎓</strong></div><div class="modal-row"><div><b>University level</b><small>${state.level||"Not selected"}</small></div><strong>${state.level||"—"}</strong></div><div class="modal-row"><div><b>Student background</b><small>${backgroundLabel}</small></div><strong>${money(state.cash)}</strong></div>${allowance}<div class="modal-row"><div><b>Academic progress</b><small>${state.studyPoints} study points</small></div><strong>Rank ${1+Math.floor(state.studyPoints/10)}</strong></div><div class="modal-row"><div><b>Reputation</b><small>Baze points</small></div><strong>${state.reputation}</strong></div><div class="modal-row"><div><b>Home</b><small>Your assigned accommodation</small></div><strong>${state.gender==="female"?"Female":"Male"} Hostel</strong></div>`);
}
function openWallet(){
 const note=state.studentBackground==="nepo"?"You began as a Nepo Baby with ₦500,000.":state.studentBackground==="amnesty"?"You began with ₦100,000. Baze University pays you ₦300,000 every 90 in-game days.":"You began as a Middle Class student with ₦100,000.";
 openModal("Wallet",`<h2 style="font-size:28px;margin:5px 0 15px">${money(state.cash)}</h2><p class="empty-note">${note} Earn extra money through ProTaxi, tutoring and freelancing.</p>`);
}
function handlePhoneApp(app){if(app==="bazetalk"){openBazeTalk();return;}phone.close();switch(app){case"map":openMap();break;case"food":openFood();break;case"jobs":openJobs();break;case"activities":openActivities();break;case"social":openSocial();break;case"profile":openProfile();break;case"wallet":openWallet();break;case"home":enterLocation(LOCATIONS.find(p=>p.id===getHostelForGender(state.gender)));break;case"save":savePlayer(state);toast("Game saved on this device.");break;}}

$("phone-teaser-open").addEventListener("click",()=>phone?.open());
document.querySelectorAll("[data-quick]").forEach(b=>b.addEventListener("click",()=>{const a=b.dataset.quick;if(a==="save"){savePlayer(state);toast("Game saved.");}if(a==="rest")runActivity("rest");if(a==="food")openFood();}));
document.querySelectorAll("[data-move]").forEach(b=>{const dir=b.dataset.move;b.addEventListener("pointerdown",e=>{e.preventDefault();world?.move(dir);});["pointerup","pointerleave","pointercancel"].forEach(ev=>b.addEventListener(ev,()=>world?.stopMove(dir)));});
window.addEventListener("beforeunload",()=>{if(state)savePlayer(state);});

// Provide a gentle first-run hint; the initial spawn is chosen from the gender selection.
