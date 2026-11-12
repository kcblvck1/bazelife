// Approximate placement inferred from the user's uploaded Baze campus-plan screenshot.
// These are game-world positions, not surveyed coordinates.
export const LOCATIONS = [
 {id:"main-entrance",name:"Main Entrance",icon:"🚪",category:"Entrance",type:"gate",x:8,z:50,w:10,d:6,h:3,color:0xb7c9d7},
 {id:"male-hostel",name:"Male Hostel",icon:"🛏️",category:"Hostel",type:"hostel",gender:"male",x:-47,z:-30,w:10,d:8,h:8,color:0xc3d5e6},
 {id:"female-hostel",name:"Female Hostel",icon:"🛏️",category:"Hostel",type:"hostel",gender:"female",x:-43,z:-49,w:12,d:9,h:8,color:0xd8c7df},
 {id:"block-f",name:"Block F",icon:"🎓",category:"Academic",type:"classroom",x:-7,z:-38,w:10,d:8,h:7,color:0xcbd8e1},
 {id:"block-e",name:"Block E",icon:"🎓",category:"Academic",type:"classroom",x:12,z:-38,w:10,d:8,h:7,color:0xd6dce0},
 {id:"block-b",name:"Block B",icon:"🎓",category:"Academic",type:"classroom",x:-22,z:-19,w:9,d:8,h:7,color:0xc5d4df},
 {id:"block-c",name:"Block C",icon:"🎓",category:"Academic",type:"classroom",x:0,z:-19,w:9,d:8,h:7,color:0xd5dce2},
 {id:"block-a",name:"Block A",icon:"🎓",category:"Academic",type:"classroom",x:-18,z:1,w:10,d:8,h:7,color:0xcbd9e4},
 {id:"block-d",name:"Block D",icon:"🎓",category:"Academic",type:"classroom",x:25,z:-28,w:11,d:8,h:7,color:0xc5d4df},
 
 {id:"chapel",name:"Chapel",icon:"⛪",category:"Community",type:"social",x:8,z:8,w:8,d:7,h:6,color:0xd9cba9},
 {id:"library",name:"Library",icon:"📚",category:"Study",type:"library",x:-4,z:4,w:11,d:8,h:7,color:0xbacbd7},
 {id:"registry",name:"Registry",icon:"📄",category:"Office",type:"office",x:-25,z:14,w:8,d:7,h:5,color:0xd8d6cd},
 {id:"senate",name:"Senate Building",icon:"🏛️",category:"Office",type:"office",x:1,z:19,w:10,d:8,h:7,color:0xd5d4cf},
 {id:"tv-danjuma",name:"TY Danjuma Centre",icon:"📺",category:"Community",type:"social",x:-34,z:-4,w:10,d:8,h:5,color:0xc3d2dc},
 {id:"football-stadium",name:"Football Stadium",icon:"⚽",category:"Sports",type:"sports",x:24,z:-14.5,w:27,d:18,h:1,color:0x72a875},
 {id:"multi-purpose",name:"Multi-purpose Hall",icon:"🏟️",category:"Sports",type:"social",x:-28,z:34,w:12,d:9,h:6,color:0xc8d2db},
 {id:"mama-wheels",name:"Mama Wheels",icon:"🍗",category:"Restaurant",type:"restaurant",restaurant:"Mama Wheels",x:-6,z:25,w:8,d:6,h:4,color:0xd8a28a},
 {id:"empty",name:"Empty",icon:"🍚",category:"Restaurant",type:"restaurant",restaurant:"Empty",x:-35,z:9,w:8,d:6,h:4,color:0xaec59f},
 {id:"two-thirty",name:"2:30 Fe Lu",icon:"🥤",category:"Restaurant",type:"restaurant",restaurant:"2:30 Fe Lu",x:23,z:24,w:8,d:6,h:4,color:0xc7b4d9},
 {id:"ibb-mall",name:"IBB Mall",icon:"🛍️",category:"Shopping",type:"shop",x:-24,z:43,w:10,d:7,h:5,color:0xd6c5ad},
 {id:"zenith-bank",name:"Zenith Bank",icon:"🏦",category:"Service",type:"office",x:-3,z:39,w:9,d:7,h:5,color:0xb8c8d4},
 {id:"medical-centre",name:"Medical Centre",icon:"🏥",category:"Health",type:"medical",x:37,z:10,w:10,d:8,h:5,color:0xd8e1e8},
 {id:"student-centre",name:"Student Centre",icon:"🫂",category:"Social",type:"social",x:39,z:29,w:11,d:8,h:5,color:0xc9d4df},
 {id:"power-house",name:"BUH Power House",icon:"⚡",category:"Utility",type:"office",x:51,z:-7,w:8,d:7,h:4,color:0xb8c0c7},
 {id:"incinerator",name:"BUH Incinerator",icon:"♻️",category:"Utility",type:"office",x:53,z:-26,w:8,d:7,h:4,color:0xbab7aa},
 {id:"sultan-sa-ad",name:"Sultan Sa'ad Building",icon:"🏢",category:"Academic",type:"classroom",x:-2,z:-9,w:8,d:7,h:5,color:0xc6d4de}
];
export const getLocation = idOrName => LOCATIONS.find(p => p.id===idOrName || p.name===idOrName);
export const getHostelForGender = gender => gender === "female" ? "female-hostel" : "male-hostel";
