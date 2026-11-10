import { clampNeed } from "../core/state.js";
export function decayNeeds(state, minutes=1){
  state.hunger-=.052*minutes;state.energy-=.026*minutes;state.fun-=.035*minutes;
  state.social-=.024*minutes;state.hygiene-=.02*minutes;state.bladder-=.075*minutes;
  for(const key of ["hunger","energy","fun","social","hygiene","bladder"])state[key]=clampNeed(state[key]);
}
export function recover(state,key,amount){state[key]=clampNeed(state[key]+amount);}
