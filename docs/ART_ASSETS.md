# Artwork and photo integration

The game uses owner-supplied photographs and character references, illustrated with the built-in ImageGen tool. No third-party asset pack, font service, image CDN, or runtime AI service is used. The original source files remain unchanged in the ignored `original_images/` folder. Generated source PNGs, exact per-image prompts, layout captures and generation reports remain in the ignored `art-work/` folder.

Only optimized WebP copies under `public/assets/` ship with the game. These files and the content JSON will be public when the owner publishes the repository/site. `public/content/assets.json` records dimensions, bytes and provenance; it deliberately omits private absolute paths, source image metadata and generation-service identifiers.

Original photos retain their full composition and orientation, including existing screenshot borders. They are resized to a maximum 1600-pixel long edge at WebP quality 83, without cropping, and contain no EXIF/GPS/XMP metadata. Illustrated versions use the original's subjects, poses, clothes and scene as identity/composition references; screenshot borders are omitted from the painted versions. The photo viewer uses `object-fit: contain` for both portrait and landscape images. Every paired themed picture explicitly invites the player to click to view the original; the original view offers the return to the illustration.

There are 35 original memory photos, with 34 corresponding illustrations. The Austin photo-booth strip is intentionally shown as **Original photo**: the image-generation service rejected its themed output, and no alternate generator or retry was used. It remains included at the separate Austin photo-booth landmark. The missing illustration is not disguised by another photo or a placeholder.

Nathaniel and Gracie have transparent four-direction sheets. Frames are normalized to a shared foot anchor and scaled to the existing world size. Directional idle frames are used with reduced motion; walking uses three subtle frames. Nathaniel's collected bouquet uses a smaller hand-relative drawing that follows his facing direction and stays attached to him when Gracie leads; its depth follows his sprite. If a sheet fails to load, the generated character fallback keeps movement and progression available. Environment art retains each map's authored interaction layout; native art is retained as an asset-failure fallback. Only Madeira's specifically authored path boundaries create collision bodies; the other eight worlds retain free decorative scenery.

Photos load when their memory is opened. Only the selected photo/view is requested in the map viewer; original copies are requested when toggled. Reader details present all photos belonging to the selected stop. Character sheets and already-loaded backgrounds are reused across maps, and a new background loads when its scene is first entered. No preload of the full photo collection, remote image requests, backend or persistent progress store is introduced.

## October 14 environment revision

The active route now uses **nine painted backdrops**: introduction, four Korea worlds, Museum of Ice Cream, the Norway scrapbook, Francine and settling in, and Madeira. The former standalone Snuromi café background and scene are archived under ignored `art-work/retired-october-14/` and excluded from the active public route. The memory counts remain **35 originals and 34 themed photographs**. Including the two character sheets and railcar, the **81 public WebPs total 18,065,286 bytes (17.23 MiB)** after the Madeira promenade revision.

| Asset | Owner reference and revised purpose | Web output |
| --- | --- | --- |
| Introduction garden | `original_images/intro_bg.jpg` supplies the recognizable formal garden, central lawn, paths, fountain and skyline. The painting leaves a clear top-left starting plaza and a letter in the bottom right; characters, controls and instructions are live overlays. | `public/assets/world/introduction.webp`, 1672×941, 336,186 bytes. |
| Pedal railcar | `original_images/railcar.jpg` supplies the red canopy, open metal chassis, four seats and pedal-car silhouette. It is a separate transparent vehicle sprite; people and incremental movement remain runtime objects. | `public/assets/vehicles/railcar.webp`, 512×383, 62,096 bytes, with alpha. |
| Francine and settling in | The existing painted Austin map is revised for the merged world: gray Goodwin, citizenship building, MAA and Snuromi access, plus photo booth, birthday lake, PJ's house and a Texas line-dancing venue. A small open garage is attached to MAA's right side. The only readable building signs are the owner-requested **Goodwin** and **MAA**. The blue car and both people remain separate live objects. | `public/assets/world/austin-francine.webp`, 1672×941, 235,284 bytes. |

These revisions were generated with built-in ImageGen and exported as optimized WebPs. Their exact prompts and correction history are recorded in `art-work/prompts/october-revisions.json`; source/output dimensions, byte counts, transparency and inspected references are recorded in `art-work/asset-manifests/october-revisions.json`. Deterministic export is recorded in `art-work/export-october-revisions.py`. The two new reference files remain unchanged in `original_images/` and are environment/vehicle references, not additions to the memory-photo collection.

The railway shows the front-car photo on boarding and the other three memories after equal ride segments. Three weathered wooden signs are live overlays at x=385, 615 and 845 on the 960×540 map. Each segment is 230 pixels with four 57.5-pixel pedals; the last photo opens after disembarking. The signs have wooden planks, grain, knots, bolts and posts with no picture symbol or number. They remain decorative during the journey. After the final game checkpoint, either leader can reopen the three signs' photographs or the boarding photo at the car; E markers appear then. The old painted signs were removed so that the live signs align. These props use the existing native drawing system and add no image downloads or collisions.

## Landmark and scrapbook refinements

The owner requested background objects that correspond to each memory. Built-in ImageGen edited the two existing painted maps using the associated photos as references, preserving their walking areas and target locations. Petite France now contains the golden Eiffel replica, blue room with gold stars, and Little Prince statue beside a pale bench and ornaments. The museum contains the pink jukebox with an ice-cream cup, nested neon arches, and a distorted pink arched mirror reflecting a sprinkle wall. People remain live sprites; there are no baked-in visitors, interface elements or new collisions. Native fallback props depict the same landmarks, and their click regions cover their visible forms.

| Saved asset | Latest dimensions | Bytes |
| --- | --- | --- |
| `public/assets/world/korea-petite-france.webp` | 1672×941 | 234,894 |
| `public/assets/world/austin-museum.webp` | 1671×941 | 62,882 |
| `public/assets/memories/real-norway-4-themed.webp` — scrapbook page 2 | 960×1440 | 184,492 |
| `public/assets/memories/real-norway-5-themed.webp` — scrapbook page 5 | 1080×1440 | 197,398 |

The two themed scrapbook pages use shorter portrait compositions. Page 2 retains the full reclining pose, crossed feet, eye mask and snacks. Page 5 trims excess library architecture while retaining Gracie's face, hand, phone, red jacket and her partner's shoulder. The original-photo views keep their full existing composition, and source originals are unchanged. Earlier versions are archived privately in `art-work/`.

Exact built-in prompts are saved in `art-work/prompts/landmark-revisions.json` and `art-work/prompts/norway-crops.json`; matching export/provenance records are in `art-work/asset-manifests/landmark-revisions.json` and `art-work/asset-manifests/norway-crops.json`. Export scripts resize and encode WebP without further image edits. The public inventory was refreshed and checked for EXIF/XMP metadata.

Final map captures covered all nine worlds without browser exceptions. The updated park and museum, the Austin interaction markers, and the fully decoded Norway page 2/5 views were inspected in the running game. Captures remain under ignored `art-work/qa/`.

## Reindeer and railway backdrop revisions

Built-in ImageGen added an antlered reindeer in a leather harness with an empty wooden sled to the left-middle snow in Norway. A tiny distant hut carries the owner-requested golden M as a minor background detail. The scrapbook, character start, aurora and walking space stay clear. These decorative objects have no interaction or collision bodies. The railway edit removes the three obsolete painted signs, posts and shadows, preserving the track and autumn scenery for the newly spaced runtime signs.

| Saved asset | Dimensions | Bytes |
| --- | --- | --- |
| `public/assets/world/norway-scrapbook.webp` | 1672×941 | 115,610 |
| `public/assets/world/korea-railway.webp` | 1672×941 | 188,428 |

Exact built-in prompts are saved in `art-work/prompts/reindeer-rail-revisions.json`; references, full source PNGs, inspected output paths and previous-version backups are recorded in `art-work/asset-manifests/reindeer-rail-revisions.json`. `art-work/export-reindeer-rail-revisions.py` only resizes and encodes the reviewed outputs. The public inventory was refreshed and checked for EXIF/XMP metadata. Original photographs remain unchanged.

The latest decoded browser captures were inspected at zero-pedal boarding, the final photo while walking, the simplified railway checkpoint, all three evenly spaced live replay signs, and the Norway map with its reindeer, sled and distant golden M. These captures remain in `art-work/qa/railway-boarding-zero-pedals.png`, `railway-final-photo-on-foot.png`, `boarding-three-stop-checkpoint.png`, `boarding-three-stop-replay-map.png` and `norway-map-latest.png`. The final build, 42 unit checks, 27 development browser scenarios and two production checks pass.

## Wooden park signs and attached MAA garage

The subsequent owner revision replaces the signs' picture symbols and numbers with plain wooden grain and weathered planks. The live signs were inspected in `art-work/qa/wooden-signs-before-ending.png`, with their interaction markers hidden until the complete journey is finished.

Built-in ImageGen edited the Austin backdrop to add a small empty garage at MAA's east wall. Its roof, open bay and pale driveway match the existing sage building; the main entrance, MAA/Goodwin signs and other landmarks remain in place. The selected output is saved at `public/assets/world/austin-francine.webp`, 1672×941 and 235,284 bytes. The garage bay is around (886,368); the live parking point is (886,380), approach (886,422), and the couple steps out at (864,440). The car's east travel limit is 888, within the world's 908 boundary. Native fallback graphics include the apartment and attached garage, with no decorative collisions.

Exact built-in prompts and the three edit reviews are saved in `art-work/prompts/maa-garage-revisions.json`; references, inspected PNG/WebP outputs, previous-art backups and rejected variants are recorded in `art-work/asset-manifests/maa-garage-revisions.json`. `art-work/export-maa-garage-revisions.py` resizes and encodes the selected output. The public inventory contains 81 WebPs totaling 17,882,020 bytes (17.05 MiB), with EXIF/XMP metadata checked. Original photographs remain unchanged. The final build, 45 unit checks, seven affected development browser scenarios and two production checks pass.

Live-game captures of the wooden signs after the ending, garage parking and final chapter-travel guidance were inspected in `art-work/qa/wooden-rail-signs-after-ending.png`, `apartment-garage-latest.png` and `final-checkpoint-travel-guidance.png`. The car aligns with the garage forecourt, MAA's main entrance remains distinct, replay markers appear only after completion, and the finale guidance fits without overflow. Runtime and public assets stayed unchanged throughout the final browser runs.

## Madeira coastal promenade

The subsequent owner revision replaces the overhead island view with a closer three-quarter seaside courtyard. A granite castle overlooks the central promenade, the Lisbon dining terrace is on the right, the Madeira meal is on the left, and Cristo Rei stands on a southeast viewing terrace. Warm stone paths form a continuous loop around two raised gardens and a route down the middle. Low walls, planted beds and cliff edges explain the seven authored barriers. All three ordinary photo stops can be visited independently; Cristo Rei requires all three.

The selected painted layout determines the runtime paths and target positions. The loop centers are x=155/800 and y=170/410; the central route is x=480. The southeast forecourt extends to y=465. The meal target is (120,360), Lisbon (835,310), castle (480,160), and Cristo Rei (835,445); each has a clear, connected approach. An exact diagram was used during generation, but the painterly composition shifted the geometry. The final collision rectangles and targets were adapted to the selected visible paths rather than retaining the unused diagram's coordinates. The native fallback depicts the same loop, gardens, castle and forecourt.

Built-in ImageGen produced `public/assets/world/madeira.webp`, **1672×941, 394,114 bytes**. Exact prompts and placement decisions are in `art-work/prompts/madeira-promenade.json`; source PNGs, old-backdrop backup, rejected drafts, the diagram and final geometry are recorded in `art-work/asset-manifests/madeira-promenade.json`. `art-work/export-madeira-promenade.py` normalizes the selected 1672×940 source by one pixel and encodes WebP without cropping. No memory photos or character sheets changed. All 34 existing authored Madeira string fields, including the personal captions, anniversary letter and ending title, were preserved.

The final build, 49 unit checks, four affected development browser scenarios and two production checks pass. The physical walk verifies the loop, central path, coast/garden barriers, southeast terrace, follower safety through Q, free photo order and the all-three-stop Cristo lock. The public inventory contains 81 optimized WebPs totaling 18,065,286 bytes (17.23 MiB), with EXIF/XMP metadata checked.

Live-game views were inspected in `art-work/qa/madeira-loop-map-latest.png`, `madeira-loop-castle-latest.png`, `madeira-lisbon-lunch-latest.png`, `madeira-cristo-locked-0-photos.png`, `madeira-cristo-locked-1-photos.png`, `madeira-cristo-locked-2-photos.png` and `madeira-final-authored-letter.png`. The five-pose contact sheet `art-work/qa/bouquet-directions-contact-sheet.png` shows the bouquet near Nathaniel's hands and staying with him when he follows Gracie; his back naturally occludes it when facing north. Runtime and public assets remained unchanged throughout the final browser runs.

## Style and prompt record

The shared direction is warm hand-painted storybook art: rounded forms, softly expressive adult faces, natural proportions, simplified detail and visible gouache brushwork. Cream, peach, sage and terracotta connect the scenes; the museum is pink, Norway blue/violet and Madeira green/coral. Original photos remain available to show exact likeness and real details.

The image prompts use this structure, followed by the scene-specific description:

> Repaint the supplied photograph in warm hand-painted storybook style. Preserve the adult identities, facial proportions, number of people and animals, poses, clothing, object positions, lighting character and composition. Use the supplied illustration as a style reference only. Keep the scene's distinctive colors and enough detail to recognize the place. No captions, decorative borders, watermarks, extra people or invented objects.

Character prompts specify a transparent 4×4 sheet with south, north, west and east rows and idle/left step/passing/right step columns. Environment prompts use a clean map screenshot as the exact layout reference, preserving paths and static interaction landmarks while excluding characters, moving vehicles and interface text. The revised Austin map includes only the two owner-requested apartment signs, Goodwin and MAA; invented business names remain excluded. Deterministic postprocessing only resizes, converts format and normalizes sheet frames.

Exact local prompt records: `art-work/prompts/characters.json`, `korea.json`, `austin-norway.json`, `portugal.json`, `world.json`, and `october-revisions.json`. The matching local manifests record the individual references and inspected outputs. These working records are retained for owner review and are excluded from the public repository.

## Content review and release

Default names follow the supplied character-reference filenames: Nathaniel and Gracie. The introductory letter still lets the recipient change both names and the greeting. Its default greeting is exactly **Three years of adventure and hardship. Three years of love and laughter. Three years of you and me.** Owner-supplied dialogue is preserved. The current personal captions, long anniversary letter and ending title in `public/content/scenes/madeira.json` remain authoritative; the earlier short-letter draft is historical. The Madeira proposal album starts with the supplied shoe-tying moment, then reveals the proposal photo and letter; closing before that reveal leaves the ending incomplete. The first caption is **the big moment... jk**; the final page hides its visible photo caption and keeps the letter. A/D and previous/next buttons navigate this ending.

Review all likenesses, captions and photo matches during the owner's walkthrough. Particular review points are the Norway library photo, the five-photo scrapbook without leader changes, the separate Austin photo landmarks and MAA/Snuromi match, the new garden and railcar likenesses, and the five images supplied in the Portugal folder. The illustrated version is an interpretation; the original view remains the source of exact details. Owner approval of the personal content and actual MacBook/Safari testing are release checks in Milestone 4.
