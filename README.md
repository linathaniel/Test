# Our dreamy GN world

**Play the game:** [https://linathaniel.github.io/Test/](https://linathaniel.github.io/Test/)

Milestone 3 integrates the full story from [GAME_DESIGN.md](GAME_DESIGN.md), personalized animated characters, illustrated environments, real photographs and the owner's final anniversary message. Asset provenance and review notes are in [docs/ART_ASSETS.md](docs/ART_ASSETS.md).

The complete journey has nine worlds:

1. **The beginning:** start in the upper left of the reference-inspired garden. Directional WASD keycaps explain movement; the lower-right letter opens names and the greeting: “Three years of adventure and hardship. Three years of love and laughter. Three years of you and me.”
2. **Our first date:** Nathaniel chooses the bouquet and leads at the closed/delivery stops; the accepted flowers stay in his hand as he turns. Gracie opens katsu and its two-photo A/D album. Trying a food stop without flowers makes Nathaniel say “OOPS I forgot to get her nice flowers” before other reminders; the delivery stop preserves the owner's local variation, “OOPS I forgot to get baby nice flowers”. Gracie's supplied role lines remain on the characters; at the delivery counter she says “this place is delivery only!”. Finish with ice cream.
3. **Fall foliage railway:** boarding shows the front-car photo without adding a pedal. Nathaniel then pedals three equal scenic segments, four presses each. The pair gets out before the final photo opens, completing the ride after **12 pedals**. Photo signs remain decorative without action markers until the full journey's ending is completed; then three signs reopen their own photos and the car reopens the boarding photo. Either person can then replay photos without boarding or changing progress, including after travelling back to this world.
4. **Smurf escape room:** click nearby floor letters or walk onto a tile and press E. The 25 tiles light directly in the world; five blue flowers provide the visual clue. No puzzle menu or answer hint appears.
5. **Petite France:** visit the four photo landmarks in any order, then hear her farewell and see the final park photo. Nathaniel leads at the lower-right statue photo; with Gracie leading, he says “I got an idea for a pic...”. Trying the final pin early makes Gracie say “I wanna stay and look at things.” The tower, statue and room objects match their photographs.
6. **Museum of Ice Cream:** explore individual photos at the pink jukebox, arches and mirror landmarks. Gracie leads at the mirror; her wrong-leader line is “I want to take a silly mirror pic”.
7. **Norway:** open one five-page scrapbook. A/D turns pages without leader restrictions.
8. **Francine and settling in:** visit Goodwin, citizenship, the photo booth, birthday lake, PJ's house and Texas line-dance place in any order, walking or driving. Gracie can use the MAA fob to open Snuromi while on foot, before or after the other visits. Nathaniel drives Francine; park in the attached garage to the right of MAA to step out, and re-enter/park again whenever revisiting. The eight photo/location flags complete the chapter. Parking remains available but is not a hidden completion requirement.
9. **Madeira:** follow the coastal loop and central path to **Madeira Meal** in the southwest, **Lisbon Lunch** on the right and **Castle View** at a castle on the upper central path. Visit these three in any order; Cristo Rei stays locked until all are seen. E reveals the final photograph from the first ending page, then E closes it to complete the ending. The final page shows the owner's current anniversary letter without a caption. Its authored wording, captions and checkpoint are preserved. Keep exploring, or use Previous chapter / Next chapter to revisit the journey.

Each world creates a dreamy checkpoint. There are 35 original memory photos and 34 illustrated versions; the photo-booth strip remains labelled Original photo. E opens/closes a memory, labelled picture hints explain toggling original/themed views, and A/D backs up previous/next buttons. Escape or Close before the proposal reveal leaves the ending incomplete. Q turns the couple toward each other without shifting their idle positions. Speech bubbles disappear after 3.15 seconds; any E continuation remains available.

The outside title stays **Our dreamy GN world**. In-map headings retain each world's name, with **Austin** as the chapter label for the former Austin/Norway scenes. Guidance, switching, interaction buttons and actor-anchored speech remain inside the game. Completed worlds provide equal-width **Previous chapter / Next chapter** controls, and Pause offers unlocked destinations; progress stays intact while revisiting. **E** continues a checkpoint on the map or in the reader. Madeira's authored barriers keep walking on its loop and central promenade; the other eight worlds remain free of decorative collisions. Goodwin and MAA have the supplied names; shops have no invented names. Trying another bouquet after acceptance makes Gracie say “I'm hangry”; the chosen bouquet's photo remains replayable.

## Run locally

Node 22.12 or newer is required; this workspace was checked with Node 22.17.0.

```powershell
npm install
npm run dev
```

Open **http://127.0.0.1:5173/annivgame/**. The page does not work by double-clicking index.html: Vite serves the JSON content and browser modules.

For the alternative story reader, open **http://127.0.0.1:5173/annivgame/?reader=1**. This route starts the DOM reader without loading Phaser or creating a renderer. The same route works on the production link with `?reader=1` appended.

## Controls and help

| Action | Control |
| --- | --- |
| Walk or drive Francine | WASD |
| Switch who leads | Q or the in-map button; the sprites face each other; park before switching drivers |
| Interact with a nearby marked object | E, the interaction button, or click the object |
| Pedal the railway car | Each separate E press moves a quarter segment; four reach a photo |
| Continue spoken dialogue to its memory | E or the speech button |
| Toggle puzzle letters | Walk onto a tile and press E, or click a nearby floor tile |
| Turn katsu, scrapbook or ending pages | A/D or the previous/next buttons |
| Replay a railway photo | After completing the whole journey, walk to its sign or car and press E or click |
| Reveal the final proposal photo | E from the first ending photo; A/D or photo buttons also navigate |
| Close a memory or scrapbook | E, Escape, or Close; the first E at the ending reveals its final photo |
| Show the original/themed memory view | Click the picture |
| Pause / resume | Escape or the pause buttons |
| Find the next stop | Pause & help → Bring us to the next dreamy stop |
| Use the movement-free alternative | Pause & help → Read our story |
| Adjust readability | Pause & help → text size and reduced motion |
| Revisit completed worlds | Previous/next world buttons, or Pause → Revisit our worlds |

The reader offers the reached scenes and current available moments in story order. Its explicit completion action supplies equivalent activity progress, allowing the full story to be finished without walking, pedaling, solving the floor, or driving. Earlier completed moments can be revisited. It keeps the same prerequisites and checkpoints.

Opening a panel or losing focus clears held movement. Railway key repeats do not count as extra pedal presses. Scrapbook paging does not move either character. Driver and travel gates protect vehicle entry, visits, exit, and apartment access. Help returns the pair to the next safe approach point without completing it.

Checkpoints and settings exist only in the current session; refreshing starts the gift again. Restart clears progress and activities while retaining the current names, greeting, text size, and motion preference. Nothing is written to localStorage or a backend.

Loading failures offer Retry. The story reader remains available if the map renderer fails. Missing photo assets preserve the caption and offer Retry; missing character/background textures use generated world art, so artwork cannot block progress.

## Validate and test

```powershell
npm run typecheck
npm run check:content
npm test
npm run build
```

Browser tests use Playwright. This Windows workspace uses its installed Edge browser:

```powershell
$env:PW_BROWSER_CHANNEL = 'msedge'
npm run test:e2e
npm run test:production
```

For a standard Chromium test environment:

```powershell
npx playwright install chromium
npm run test:e2e
```

The content validator checks 9 worlds and 30 authored interactions, exact-case public paths, captions/alt text, photo pairs and sprite dimensions. Forty-nine unit tests cover supplied dialogue and priority reminders, leader/travel rules, 12 pedal steps with a boarding photo, the full-journey replay gate, proposal reveal contract, France/mirror leadership, puzzle recovery, scrapbook visits, backward navigation and restart preferences. Obstacle scenes also require connected safe approaches and clear interaction lines. Units check Madeira's blocked shortcuts and all six photo orders; Austin completion is checked across 5,040 photo-order/MAA-position routes.

The current Madeira art revision passes **49 unit checks, the focused development Madeira walkthrough, and the production build**. The walkthrough covers the curved loop and central road, physical coastal/inland barriers, Q/follower behavior, all three photo visits in reverse order, and the all-three-stop ending lock. TypeScript and content validation pass with nine scenes, 30 interactions and 90 exact-case public file references. Earlier passing runs remain recorded in GAME_DESIGN.md. Actual MacBook/Safari verification and the owner's full content/likeness walkthrough remain release checks.

The 81 optimized WebP assets total **18,002,232 bytes (17.17 MiB)**. Madeira uses the same warm painted style and cream/sage frame as the other worlds, with curbed cobblestone roads and integrated restaurant terraces, castle forecourt and coastal statue overlook. Its background is **1672 × 941**, 331,060 bytes. The themed Norway pictures on scrapbook pages 2 and 5 use cropped compositions at **960 × 1440** and **1080 × 1440**; original-view pictures retain their full composition. Artwork was generated with built-in ImageGen and visually inspected; prompts remain in ignored `art-work/prompts/`.

The development browser scenarios cover the complete activity journey, the alternative reader, focus and key-repeat boundaries, vehicle entry/exit and driving, photo fallback, loading Retry, refresh/restart, and laptop/large-text layout. Generated screenshots and traces are ignored under test-results/. Development-only canvas diagnostics are absent from the production build.

For the actual production preview:

```powershell
npm run build
npm run preview
```

Open **http://127.0.0.1:4173/annivgame/** or its **?reader=1** route.

## Where things live

- public/content/game.json — title, default names/greeting, and the ordered scene manifest.
- public/content/scenes/ — positions, speaker/leader/travel requirements, prerequisites, activities, photo albums, completion flags and scene links.
- public/assets/ — optimized characters, environment backdrops, illustrated photos and uncropped original web copies.
- public/content/assets.json — publishable size/dimension/provenance inventory.
- src/content/ — TypeScript contracts, validation, and base-aware JSON loading.
- src/state/session.ts — session modes, counters, puzzle selections, scrapbook page visits, vehicle state, role/travel gates, reader completion, checkpoints, and restart.
- src/world/ — input ownership, geometry, generated art, following, and vehicle/railway presentation.
- src/scenes/WorldScene.ts — one reusable Phaser scene with lifecycle cleanup and world interactions.
- src/ui/app.ts — naming/help/memory/activity/reader dialogs, focus restoration, in-map controls, and character speech.
- src/main.ts — coordinates activity actions, UI, travel, and scene changes.
- original_images/ — 39 local references, including two character photographs, intro_bg and railcar; ignored and excluded from the build. Only optimized memory-photo copies and artwork ship.
- art-work/ — ignored source artwork, exact prompts and visual-review records.
- scripts/prepare-originals.py — creates oriented, uncropped original WebPs without EXIF metadata.
- scripts/prepare-asset-manifest.py — refreshes the optimized asset inventory and checks for metadata.

To add a scene, create a JSON file, list it in game.json, and link its ID from the preceding scene. Validation rejects broken chains, invalid leaders, duplicate IDs/flags, impossible prerequisites, unsupported activity payloads, and blocked/out-of-bounds placement. Activities extend the explicit content union and shared coordinator rather than creating separate game loops.

Photographs are lazy-loaded by the selected moment and view. No Gemini-prepared images are required. Review the illustrated likenesses, photo-to-moment matches and captions before publication; originals remain available in the game to preserve the real details.

## GitHub Pages

The repository is [linathaniel/Test](https://github.com/linathaniel/Test). Local development uses `/annivgame/`; the **Publish game to GitHub Pages** workflow in `.github/workflows/pages.yml` derives `/Test/` for this repository.

For initial setup, choose **Settings → Pages → Source: GitHub Actions**. Publishing then runs automatically whenever `main` is updated; **Publish game to GitHub Pages → Run workflow** in the Actions tab remains available for manual publishing. The workflow installs lockfile dependencies, runs the unit checks, validates content, builds the game with the repository's base path, and publishes `dist/`. The game address is [https://linathaniel.github.io/Test/](https://linathaniel.github.io/Test/).

For another local base in PowerShell:

```powershell
$env:GAME_BASE_PATH = '/another-repository/'
npm run build
```

All public/ content and public Git history are shareable. Raw references and editable art stay ignored; public/ contains the optimized web copies. Publishing, public-sharing review and actual MacBook testing belong to Milestone 4.

## Pinned toolchain

Phaser 4.2.1, TypeScript 5.9.3, Vite 7.3.7, Vitest 5.0.4, Playwright 1.64.0. Commit package-lock.json with the source for repeatable installations. No runtime backend, storage service, image library, remote fonts, or audio is needed.
