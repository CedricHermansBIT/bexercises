# Avatar studio: instructor preview

Find **Avatar studio** on the admin dashboard. The page and API remain restricted
to administrators. Students receive 403 from the API. Public profiles and
leaderboards do not display avatars yet.

The preview uses original, rounded 3D human characters modeled in Blender. Drag
the preview, use its arrow buttons, or focus the canvas and press left/right to
rotate. Character, hairstyle, skin tone, hair color, outfit, top color, trouser
color, shoe color and hats are independent choices. Helmets and covering hats hide
hair without changing the chosen hairstyle; removing the hat reveals it again.
Changing a character preserves customized colors and hair. The space suit has a
life-support backpack, hose, gloves, pressure seals,
armored knees and moon boots; its helmet can also be worn with other outfits.
Outfits such as the space suit cover the trousers,
so the trouser color is visible with everyday outfits.

There are 123 wardrobe choices, including 16 hairstyles, 15 hat choices,
14 accessories, 23 top colors, nine skin tones, 14 hair colors, and 12 colors
each for trousers and shoes. Two secret rewards appear only once earned.
Alex, Mika, everyday clothes, basic hairstyles, all skin tones and basic colors are free.
Locked items can be previewed, but both the UI and server prevent saving them.
Use **Surprise me** to remix unlocked choices without saving. **Unlocked only**
filters the current category. The page scrolls normally; on desktop the preview
and its controls stay beside the wardrobe, and the preview panel can scroll on
short screens. On phones everything follows the document flow.

Saved looks belong to the signed-in account and survive changing devices.

| Existing achievement | Avatar rewards |
| --- | --- |
| Answer to Everything | Answer-to-everything propeller |
| Nice | Nice 69 glasses |
| Centurion | Centurion helmet |
| Snoop Dogg | 420 mushroom |
| Thousandaire | Thousandaire top hat |
| 1337 Elite | 1337 pixel shades |
| Helpful Nudge | Bright ideas, Rubber duck debugger |
| First Steps | Lab coat |
| Chapter Master | Chapter wizard |
| Complete Mastery | Graduation cap |
| Comeback Kid | Comeback crest |
| Persistent | Focus headphones |
| Never Give Up | Never-give-up Viking |
| Quick Learner | Robin, Learner gold |
| Dedicated | Sage, Explorer braid |
| Master | Space suit, Space helmet |
| Legendary | Problem-solver crown |
| Six Seven | Six Seven specs |
| Never Gonna Give You Up | Retro pop pompadour |
| Hackerman | Matrix shades |
| Perfectionist | Top knot, First-try bow tie |
| Flawless | Flawless silver |
| Untouchable | Superstar specs |
| Speed Demon | Lightning earrings |
| Marathon Runner | Marathon headband |
| Streak Starter | Streak ember |
| Committed | Streak flame |
| Unstoppable | Unstoppable wings |
| Night Owl | Night owl eyes |
| Early Bird | Early bird nest |
| Any language mastery achievement | Language master medal |

The studio shows each achievement's name and description beside its reward.
Achievements must actually be earned; the studio does not infer them from a
completion count. Unlocks are recorded when opening the studio and remain
available even if progress is reset later. Avatar changes do not spend points
or modify achievements or exercise progress.

`user_avatars` holds the equipped selection; `user_avatar_unlocks` holds permanent
item unlocks. Both reference the user with cascading deletion. Startup migrations
create these tables. Existing four-field selections retain their character IDs
and expand to matching hair/skin presets; existing permanent unlocks are retained.
Old clients preserve customized hair and colors when saving their four fields.

- `GET /api/admin/avatar`: own selection, catalog, named achievement requirements.
- `PUT /api/admin/avatar`: complete selection (`character`, `outfit`, `accessory`,
  `color`, `skin`, `hair`, `hairColor`, `pantsColor`, `shoesColor`, `hat`). Legacy
  four-field and nine-field selections preserve newer customization. Unknown IDs,
  extra fields, incomplete new selections
  and locked items are rejected.

The viewer, model and thumbnails are served locally under the existing CSP.
Three.js is bundled into `frontend/js/vendor/avatar3d.bundle.js`; this generated
bundle is committed so production does not need a compiler or development
packages. After changing viewer source, run `npm run build:avatar`. WebGL failure
falls back to a static character render; that fallback does not reflect every
customized attribute. Offscreen/hidden previews pause rendering, and reduced
motion disables the idle movement.

See [the model source workflow](../src/avatar-models/README.md) for the editable
Blender project and regeneration instructions. Blender is only needed to edit
or regenerate the artwork, not to run BITLab.

Run `node --test src/tests/avatars.test.js` for authentication, persistence,
legacy compatibility, achievement unlocks, palette safety and model checks.
Restart BITLab after deploying backend changes.
