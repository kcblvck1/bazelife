export function performActivity(state,action){
 const hostel=state.location===(state.gender==="female"?"Female Hostel":"Male Hostel");
 switch(action){
  case "sleep": if(!hostel)return {ok:false,message:"Go to your own hostel to sleep."};state.energy=100;state.fun=Math.min(100,state.fun+12);state.hunger=Math.max(0,state.hunger-9);state.hygiene=Math.max(0,state.hygiene-8);return {ok:true,message:"You slept and restored your energy." ,minutes:480};
  case "shower": if(!hostel)return {ok:false,message:"Use the shower in your own hostel."};state.hygiene=100;return {ok:true,message:"You feel fresh. Hygiene restored.",minutes:15};
  case "toilet": if(!hostel)return {ok:false,message:"Use the toilet in your own hostel."};state.bladder=100;return {ok:true,message:"Bladder restored.",minutes:5};
  case "study": if(!["classroom","library"].includes(actionPlaceType(state.location)))return {ok:false,message:"Go to a classroom or the Library to study."};if(state.energy<10)return {ok:false,message:"You are too tired to study."};state.energy-=10;state.fun=Math.max(0,state.fun-5);state.studyPoints+=2;state.reputation+=1;return {ok:true,message:"Study session completed. +2 study points.",minutes:60};
  case "research": if(state.energy<8)return {ok:false,message:"You are too tired to research."};state.energy-=8;state.studyPoints+=1;return {ok:true,message:"Research completed. +1 study point.",minutes:45};
  case "social": state.social=Math.min(100,state.social+25);state.fun=Math.min(100,state.fun+10);state.reputation+=1;return {ok:true,message:"You spent time with other students.",minutes:25};
  case "fun": if(state.energy<10)return {ok:false,message:"You are too tired to play."};state.energy-=10;state.fun=Math.min(100,state.fun+30);return {ok:true,message:"You had fun!",minutes:35};
  case "exercise": if(state.energy<15)return {ok:false,message:"You need more energy to exercise."};state.energy-=15;state.fun=Math.min(100,state.fun+15);state.hunger=Math.max(0,state.hunger-8);state.hygiene=Math.max(0,state.hygiene-10);return {ok:true,message:"Exercise completed.",minutes:40};
  case "rest": state.energy=Math.min(100,state.energy+25);return {ok:true,message:"You rested. +25 energy.",minutes:30};
  case "admin": state.reputation+=1;return {ok:true,message:"You checked in at the administration office.",minutes:10};
  default:return {ok:false,message:"That action is not available here."};
 }
}
function actionPlaceType(location){if(["Block A","Block B","Block C","Block D","Block E","Block F","Engineering","Laboratory Complex","Sultan Sa'ad Building"].includes(location))return "classroom";if(location==="Library")return "library";return "other";}
