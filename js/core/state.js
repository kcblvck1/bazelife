export const NEEDS = ["hunger", "energy", "fun", "social", "hygiene", "bladder"];

export const DEFAULT_APPEARANCE = {
  skinTone: "#89583f",
  hairStyle: "lowcut",
  hairColor: "#211b18",
  topStyle: "tshirt",
  topColor: "#4d7190",
  bottomStyle: "trousers",
  bottomColor: "#26394e",
  shoeColor: "#20252b"
};

export function createNewState(profile = {}) {
  const gender = profile.gender === "female" ? "female" : "male";
  const hostel = gender === "female" ? "Female Hostel" : "Male Hostel";
  return {
    username: profile.username || "student", name: profile.name || "Student",
    gender, appearance: { ...DEFAULT_APPEARANCE, ...(profile.appearance || {}) },
    onboardingComplete: false, course: "", level: "", studentBackground: "",
    cash: 100000, hunger: 100, energy: 100, fun: 100, social: 100,
    hygiene: 100, bladder: 100, day: 1, hour: 8, minute: 0,
    location: hostel, rides: 0, taxiBonusClaimed: false, studyPoints: 0,
    reputation: 0, home: hostel, career: "Student", completedActions: 0,
    nextAmnestyAllowanceDay: null,
    lastAction: "You woke up in your hostel. Open your phone to explore campus."
  };
}
export function clampNeed(value) { return Math.max(0, Math.min(100, Math.round(value))); }
export function money(value) { return "₦" + Math.round(value).toLocaleString("en-NG"); }
export function getDayName(day) { return ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"][(day - 1) % 7]; }
