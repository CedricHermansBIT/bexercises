# Avatar studio: instructor preview

Find **Avatar studio** on the admin dashboard. The page and API are restricted to
administrators; students have no entry point and receive 403 from the API. No
public avatars are added to leaderboards or student profiles in this version.

The studio has four illustrated characters, four outfits, four accessory choices
and six colors. Byte, Sprout, the tee, hoodie and all colors are available from
the start. Locked items can be previewed, but the server prevents saving them.
Saved looks belong to the signed-in account and survive changing devices.

| Unlock | Requirement |
| --- | --- |
| Lab coat | Complete 3 exercises |
| Pixel fox and focus headphones | Complete 5 exercises |
| Debug cat | Complete 10 exercises |
| Space suit | Complete 15 exercises |
| Crown | Complete 20 exercises |
| Bright ideas glasses | Earn Helpful Nudge by opening a hint |

Completions count distinct completed exercises rather than repeated runs.
Achievements must actually be earned. Earned avatar unlocks are recorded when
opening the studio and remain available even if progress is reset later. Avatar
changes do not spend points or modify achievements or exercise progress.

`user_avatars` holds the equipped selection; `user_avatar_unlocks` holds permanent
item unlocks. Both tables reference the user with cascading deletion. Standard
startup migration creates them, so restart BITLab after deploying the change.
There are no image uploads, remote artwork or extra image dependencies: the
illustrations use local SVG shapes and a fixed color palette.

- `GET /api/admin/avatar`: own selection, wardrobe and unlock progress.
- `PUT /api/admin/avatar`: complete selection (`character`, `outfit`, `accessory`,
  `color`). Unknown IDs, extra fields and locked items are rejected.

Run `node --test src/tests/avatars.test.js` for access, persistence, unlock and
renderer checks. The feature remains an admin preview until its entry points and
server authorization are explicitly changed.
