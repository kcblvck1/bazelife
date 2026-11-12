# BAZE LIFE — modular browser game

A single-player Baze University student-life simulator built with HTML, CSS, JavaScript modules and Three.js.

## Run the game

1. Extract the complete `BAZE-LIFE-Rebuilt` folder.
2. Open the folder in VS Code.
3. Install/enable the **Live Server** extension if it is not already installed.
4. Right-click `index.html` and choose **Open with Live Server**.
5. An internet connection is needed because Three.js and the Google font are loaded from CDNs.

Do not open `index.html` by double-clicking it. ES modules and browser storage behave more reliably over `http://localhost`.

## Project structure

```text
BAZE-LIFE-Rebuilt/
├── index.html
├── README.md
├── css/main.css
├── js/
│   ├── main.js
│   ├── core/             # default player state and browser storage
│   ├── interface/       # phone UI
│   ├── systems/         # needs, restaurants, jobs and activities
│   └── world/           # campus locations and Three.js world/interiors
└── assets/maps/         # uploaded campus-plan, entrance photo and visual style references
```

## Current features

- Local sign-up and login with a male/female selection.
- New male students start in the Male Hostel; new female students start in the Female Hostel.
- A Three.js isometric campus scene with roads, landscaped areas, parking, stadium, low-poly buildings, a reconstructed main entrance gate with separate IN/OUT lanes, road-following cars and walking student NPCs in varied campus outfits.
- Clickable map markers for campus locations; click a marker to travel into that location. Empty is placed at the former BRIM Centre site; BRIM Centre and Animal House are removed; Engineering is renamed Block D. Block B contains Chemistry, Physics and Biology laboratories.
- First-person-style interior scenes with WASD/arrow-key movement, mouse-drag look controls and mobile movement buttons.
- Moving NPCs inside classrooms, the library, hostels, restaurants and other interiors.
- A smartphone-style in-game phone with map, food, jobs, activities, social, profile, wallet, hostel and save apps.
- Needs displayed as whole-number percentages.
- Original restaurant names and menus: Mama Wheels, Empty and 2:30 Fe Lu.
- Starting cash ₦100,000; ProTaxi pays ₦3,000 per ride, maximum five rides per day, plus ₦10,000 after the fifth ride. Tutoring and freelancing are also available.
- Game state autosaves locally in the browser per username.

## Controls

- **Campus map:** Open the Student Phone and tap Campus Map, or use the Campus Map button above the scene.
- **Travel:** Click a labelled map marker.
- **Interior movement:** W/A/S/D or arrow keys.
- **Look around:** Drag the mouse (or drag on the scene on a touch screen).
- **Mobile movement:** Use the on-screen directional pad while inside a location.
- **Phone:** Open Phone in the game header.

## Important limitations

- The supplied campus screenshot is included under `assets/maps/` as a reference. The live Three.js scene is assembled from 3D objects; the building footprints and positions are approximate interpretations of the screenshot, not surveyed architectural coordinates or an official digital campus model.
- This is a local browser prototype. Accounts and saves are stored in localStorage on one browser/device. It is not secure production authentication and does not sync between devices or provide multiplayer.
- Three.js is imported from jsDelivr. If the 3D scene does not load, check your internet connection and the browser console.
- NPCs use lightweight procedural walking animations, not motion-captured character assets.


## Latest campus layout update

- **Empty** now occupies the former BRIM Centre location; the BRIM Centre location has been removed.
- **Engineering** is now **Block D**.
- **Animal House** has been removed.
- **Block B** now contains three clearly labelled laboratory bays: Chemistry, Physics and Biology.
- The main entrance has separate vehicle entry and exit lanes, concrete gate pillars, a Baze University sign and security booths, inspired by the supplied entrance photograph.
- Cars follow a defined campus-road spline and pass through the entry/exit lanes rather than moving in a straight line beyond the campus.
- Student NPCs now have varied shirts, trousers, skirts, shoes, hairstyles and backpacks, with basic arm/leg walking animation.


## Latest campus layout updates
- Campus map widened with more spacing between buildings.
- Football stadium moved away from vehicle roads; Female Hostel moved to its former position.
- M-Sauce removed.
- Buildings use an ash-and-white palette.
- Hostels now show two single beds per shared room.
- Vehicles follow a defined campus road loop, with corrected forward orientation.
- Entry and exit boom gates animate when cars approach; the Main Entrance location opens a dedicated gate scene.

## Latest campus and gameplay update
- Campus vehicle traffic is restricted to a perimeter boulevard with dedicated entrance/exit approaches; internal pedestrian paths are separate.
- The campus map opens at a closer default zoom, with buildings spaced across a larger campus footprint.
- The football stadium is behind Block D; the Female Hostel occupies the former stadium area.
- The separate Staff Offices building has been removed; staff office furniture is included inside academic block interiors.
- Hostel rest/sleep actions show the student lying on a bed for five seconds before the game action completes. Hostel rooms contain two beds.
- Restaurants use a dining-room interior with reception counter, tables, chairs and waiter NPCs. Each restaurant's View Menu action displays only its own menu.
- Restaurant food service is available from 8:00 AM until 8:30 PM.
- Campus lighting and sky change with the in-game clock; street lamps illuminate at night.


## Latest requested gameplay and visual fixes

- Interior locations now use a third-person follow camera with a visible player character; WASD/arrow movement moves the character rather than the camera.
- Interior movement is constrained by room boundaries and key furniture/obstacle collision zones.
- Ambient NPCs no longer roam through furniture or buildings. Restaurant customers are positioned at dining chairs in seated poses.
- Sleep and Rest in the hostel now move the player character to a bed before showing the five-second lying-down animation.
- The football pitch has been repositioned farther inside the campus, clear of the perimeter road.
- The website interface now uses dark grey as its default background and dark panels for the main game UI.


## Latest interaction update
- Tap/click the hostel bed to open the Rest (5 seconds) or Sleep (10 seconds) menu.
- Tap the floor inside an interior to move the player; keyboard movement is disabled. Drag to look around.
- The hostel room now includes two individually selectable beds and a blueprint-inspired attached toilet area.
- Male and female character references are included in the account creation screen, and the in-world player model uses gender-specific styling.
- The Social app lists other accounts registered in the same browser profile and allows a local greeting.

### Multiplayer note
Accounts, saves and the current social directory are stored in browser localStorage. This is a local prototype, not shared online accounts: players on separate devices cannot see one another yet. A hosted backend (for example, Firebase or Supabase), secure authentication and live presence/chat services are required for real cross-device multiplayer.

## Cross-device multiplayer setup (Supabase)

The multiplayer client is included but intentionally remains in local-only mode until you add your own Supabase project credentials.

1. The Supabase project URL and publishable browser key have already been added to `js/core/supabase-config.js`.
2. In the Supabase SQL Editor, run `supabase/schema.sql` from this project. It creates student profiles, a campus chat table, row-level security policies and a profile-creation trigger.
3. In **Authentication → URL Configuration**, add your Live Server URL (for example `http://127.0.0.1:5500`) to the allowed redirect URLs.
4. For quick testing, configure Supabase Auth email confirmation to match your testing needs. Real students should use their own email addresses and strong passwords.
5. Reload the site. Create accounts with email addresses; online login uses email + password. The Social app then loads cross-device student profiles and campus chat. Supabase Realtime presence indicates connected players.

**Security:** The configured key is a Supabase publishable key intended for browser use. Never replace it with a `service_role` or secret key. Keep Row Level Security enabled.

### Multiplayer scope and safety

- Supabase Auth handles passwords; the game does not store online passwords locally.
- The public profile table exposes username, display name, gender, hostel/campus location and last-seen time to authenticated players. Do not put private contact details there.
- Campus chat is available to authenticated users and messages are limited to 500 characters.
- This increment implements account/profile sync and live presence/chat foundations. It does not yet synchronize 3D character positions or animate other registered players inside the same rendered room; that is a separate multiplayer-world milestone.
- Local username/password accounts continue to work in local mode. They are not automatically migrated to Supabase; each player must create an online account.


## Latest requested visual and multiplayer implementation (November 2026)

- Enterable interiors now use an open-top, elevated isometric/cutaway camera so the floor plan and embedded furnishings remain visible together.
- Both hostel variants use the supplied 220 sq. ft. two-bed hostel blueprint: two single beds, storage/wardrobe furniture, a study station and an attached ensuite sized from the 12.2 ft bedroom / 5.7 ft × 4.4 ft toilet callouts. The supplied blueprint is retained at `assets/interiors/hostel-blueprint.jpg`.
- The uploaded building cutaway screenshot is retained at `assets/maps/building-interior-view-reference.png` as the view-style reference.
- Authenticated students in the same named game location now publish their in-room character positions through Supabase Realtime Presence. Other students in that same location receive visible character models.
- T Social now starts with username search. Search results provide a private Message action; one-to-one messages are stored separately from public campus chat and protected by sender/recipient Row Level Security policies.
- The football stadium/pitch is relocated to the interior campus area at the updated `football-stadium` coordinates, away from the perimeter vehicle road.

### Required Supabase update

After deploying this version, run the updated `supabase/schema.sql` in the Supabase SQL Editor. It creates the `direct_messages` table, participant-only read policy, authenticated sender insert policy and Realtime publication entry. Re-running the script is safe. Existing public campus chat remains separate from private conversations.

### Multiplayer notes

- Both students must use authenticated Supabase accounts and be connected to the same configured Supabase project.
- Character visibility is location-scoped: a player is rendered only when their current `profiles.location`/presence location matches the viewer's current game location.
- Character position and facing are shared through Realtime Presence. This is a lightweight prototype implementation; it does not yet provide server-authoritative physics, anti-cheat validation or persistent message read receipts.
