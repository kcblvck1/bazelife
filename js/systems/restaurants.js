import { money } from "../core/state.js";
export const MENUS={
 "Mama Wheels":[["Caribbean Rice",3000,40],["Shawarma",2800,35],["Milkshake",2800,35],["Zobo",700,12],["Water",300,5]],
 "Empty":[["Fried Rice",1500,25],["Jollof Rice",1500,25],["Parfait",1200,20],["Orange Juice",500,10],["Bottled Soda",700,12],["Iced Tea",800,15],["Fruit Smoothie",1000,18],["Water",300,5]],
 "2:30 Fe Lu":[["Jollof Rice",2800,35],["Shawarma",2500,32],["Milkshake",2500,32],["Water",300,5]],
 "Cafeteria":[["Fried Rice",1500,25],["Jollof Rice",1500,25],["Water",300,5]]
};
export function renderFoodHTML(state, restaurant){
 const items=MENUS[restaurant];
 if(!items)return `<p class="empty-note">There is no menu registered for this location.</p>`;
 return `<section class="food-section"><h3>${restaurant} menu</h3>${items.map(([name,price,gain])=>`<div class="modal-row"><div><b>${name}</b><small>${money(price)} · +${gain}% hunger</small></div><button data-buy-food data-restaurant="${restaurant}" data-name="${name}" data-price="${price}" data-gain="${gain}">Buy</button></div>`).join("")}</section>`;
}
export function purchaseFood(state,{restaurant,price,gain,location}){
  const minutes=state.hour*60+state.minute; if(minutes<8*60||minutes>20*60+30)return {ok:false,message:`${restaurant} is open from 8:00 AM to 8:30 PM.`};
  if(restaurant!=="Cafeteria"&&location!==restaurant)return {ok:false,message:`Travel to ${restaurant} before buying there.`};
  if(restaurant==="Cafeteria"&&location!=="Cafeteria")return {ok:false,message:"Travel to the Cafeteria before buying."};
  if(state.hunger>=100)return {ok:false,message:"Your hunger is already full."};
  if(state.cash<price)return {ok:false,message:"You don't have enough money."};
  state.cash-=price;state.hunger=Math.min(100,state.hunger+gain);state.energy=Math.min(100,state.energy+Math.floor(gain/2));
  return {ok:true,message:"Meal purchased. Hunger restored."};
}
