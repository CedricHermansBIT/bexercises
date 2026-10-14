# Avatar studio: instructor preview

Find **Avatar studio** on the admin dashboard. The page and API remain restricted
to administrators. Students receive 403 from the API. Public profiles and
leaderboards do not display avatars yet.

The preview uses original, rounded 3D human characters modeled in Blender. Drag
the preview, use its arrow buttons, or focus the canvas and press left/right to
rotate. Character, hairstyle, skin tone, hair color, outfit, top color, trouser
color and shoe color are independent choices. Changing a character preserves
customized colors and hair. Outfits such as the space suit cover the trousers,
so the trouser color is visible with everyday outfits.

There are 43 wardrobe choices, including six hairstyles. Alex, Mika, everyday
clothes, three basic hairstyles, all skin tones and basic colors are free.
Locked items can be previewed, but both the UI and server prevent saving them.
Saved looks belong to the signed-in account and survive changing devices.

| Reward | Existing achievement |
| --- | --- |
| Lab coat | First Steps |
| Robin and Learner gold top color | Quick Learner |
| Sage and Explorer braid | Dedicated |
| Space suit | Master |
| Problem-solver crown | Legendary |
| Bright ideas glasses | Helpful Nudge |
| Focus headphones | Persistent |
| Top knot | Perfectionist |
| Comeback crest hairstyle | Comeback Kid |
| Flawless silver hair color | Flawless |

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
  `color`, `skin`, `hair`, `hairColor`, `pantsColor`, `shoesColor`). Legacy four-field
  selections are accepted. Unknown IDs, extra fields, incomplete new selections
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
