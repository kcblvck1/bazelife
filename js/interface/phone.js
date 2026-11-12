export function bindPhone({onApp}){
 const overlay=document.getElementById("phone-overlay");
 const open=()=>{overlay.hidden=false;};const close=()=>{overlay.hidden=true;};
 document.getElementById("open-phone-button").addEventListener("click",open);
 document.getElementById("phone-teaser-open").addEventListener("click",open);
 document.getElementById("phone-chevron").addEventListener("click",open);
 document.getElementById("close-phone").addEventListener("click",close);
 overlay.addEventListener("click",e=>{if(e.target===overlay)close();});
 document.querySelectorAll("[data-app]").forEach(button=>button.addEventListener("click",()=>onApp(button.dataset.app)));
 return {open,close};
}
