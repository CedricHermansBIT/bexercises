# Avatar studio

Every signed-in user can open **Character studio** from the top-right account
menu. Their equipped character replaces the person icon. Rankings show character
portraits; click a portrait or name to open a read-only profile with the full
rotatable character, exercises completed, test runs, achievements and points.
Online-user rows open the same profile. The admin user detail view places the
saved full character beside account information, above statistics and progress.
Admins have a
dashboard shortcut. The old admin studio URL redirects to `/pages/avatar.html`.

Only equipped catalog IDs are shared in authenticated ranking and online-user responses.
Saved looks, unlocks and progress stay account-private. Students cannot include
admins in rankings or access other admin tools. One offscreen renderer generates
cached portraits as ranking rows approach the viewport, avoiding a WebGL context
and animation loop for every row. Devices without WebGL use local artwork.

## Wardrobe and preview

The studio has 156 choices across 16 categories. Every category has at least five
visible, actual choices, excluding “none” and secret rewards. Glasses, audio,
jewellery, back gear and shoulder companions are independent slots. Hats include
crowns. Colors, hair, clothing, face shape and personality can be mixed separately.
Existing one-accessory records migrate into the appropriate new slot.

Drag or use the arrow buttons to rotate; scroll or use +/− to zoom. Categories
frame the relevant area. Back gear turns the character around to show backpacks.
**Full view** restores the overview. **Surprise me** remixes unlocked choices
without saving. **Unlocked only** filters the current category. The document and
short-screen preview panel both scroll; on phones the preview follows the normal
page flow. Saved looks and next unlocks are collapsible panels.

Competing headwear replaces conflicting gear when choosing new items. Saved
combinations show a fit note if gear is covered. Crowns and nests perch above
large hair, headphones expand around hair, covering hats conceal hair, and back
gear clears or replaces the space-suit backpack. Long hair covers the hoodie hood.
The space suit has gloves, pressure seals, knee armor, moon boots and an oxygen
hose; its helmet is a separate choice.

## Personality

Five idle personalities have distinct silhouettes: relaxed, hands-on-hips
confidence, shy folded arms, happy bouncing, and sleepy nodding with closed eyes.
Five celebrations use articulated shoulders, elbows and a waist: a one-handed
wave, overhead victory cheer, happy hopping, alternating-arm dance and a waist bow.
Select a favourite celebration and use **Celebrate** to play it. Personality and
celebration are saved with the equipped avatar and each named look.

The propeller spins, wings flap, ducks bob, birds hop, tassels sway, flames flicker
and decorative accents pulse. Reduced motion keeps the selected static personality
but disables movement, blinking and gesture buttons. Offscreen/hidden previews
pause rendering. Every frame starts from rest transforms to avoid drift.

The photo booth has been removed while the editor and character poses mature.

## Saved looks

Five named slots per account hold favourite looks. Names must contain 1–40
characters. Loading a slot previews it; **Save avatar** equips it. Saving or
replacing a named look does not equip it. Deleting a slot leaves the preview and
equipped avatar intact. The server validates every selected item against that
account’s unlocked wardrobe. No points are spent and no exercise progress changes.

`user_avatars` stores the equipped selection, `user_avatar_looks` stores named
slots, and `user_avatar_unlocks` stores permanent rewards. All reference the user
with cascading deletion. Startup creates missing tables.

- `GET /api/avatar/profiles/:userId`: equipped character and aggregate public statistics;
  archived accounts are unavailable, and student requests cannot view admin profiles.
- `GET /api/avatar/appearance`: own equipped IDs only, with no unlock writes.
- `GET /api/avatar`: selection, catalog, next unlocks, and own saved looks.
- `PUT /api/avatar`: complete equipped selection.
- `PUT /api/avatar/looks/:slot`: `{name, selection}`, with slot 1–5.
- `DELETE /api/avatar/looks/:slot`: clear only that account’s slot.

Selection fields are `character`, `outfit`, `accessory` (glasses), `color`, `skin`,
`hair`, `hairColor`, `pantsColor`, `shoesColor`, `hat`, `audio`, `jewellery`, `back`,
`companion`, `idle` and `celebration`. Legacy four-, nine- and ten-field selections
are accepted and preserve newer customization. Unknown IDs, extra fields,
incomplete selections and locked items are rejected.

## Achievement rewards and progress

Rewards require actually earned achievements. Opening the studio records earned
unlocks permanently; it never grants achievements based on counters. Unlocks
survive progress resets. Secret rewards appear only after they are earned.

Next unlocks group the closest measurable rewards by achievement. They use real
completion, first-try, attempt, persistence, speed, streak and chapter counters.
First-try counts use attempts at completion, so later reruns do not change them.
Time/action achievements with no meaningful numerical measure show their actual
requirement instead. A reached counter can still require earning the achievement;
previewing does not award it. No eligible chapters means no fabricated progress.

Complete Mastery counts nonempty chapters only in enabled (published) languages.
Locked languages do not block it, and an empty published curriculum cannot award
it. Language rewards require the matching existing language mastery achievement:
Python unlocks the shoulder snake, Bash the terminal backpack, and SQL/MySQL/
MariaDB/PostgreSQL the database hat. Any language mastery also unlocks the code medal.

| Existing achievement | Avatar rewards |
| --- | --- |
| Answer to Everything | Answer-to-everything propeller, Tiny robot pal |
| Nice | Nice 69 glasses, Cat-ear headphones |
| Centurion | Centurion helmet |
| Snoop Dogg | 420 mushroom |
| Thousandaire | Thousandaire top hat |
| 1337 Elite | 1337 pixel shades, RGB gaming headset |
| Helpful Nudge | Bright ideas, Rubber duck debugger, Rubber duck pal |
| First Steps | Lab coat, First-step star pin |
| Chapter Master | Chapter wizard, Scholar bookbag |
| Complete Mastery | Graduation cap |
| Comeback Kid | Comeback crest |
| Persistent | Focus headphones |
| Never Give Up | Never-give-up Viking, Slow-and-steady shell |
| Quick Learner | Robin, Curious cat pal, Learner gold |
| Dedicated | Sage, Explorer braid, Studio headset |
| Master | Space suit, Space helmet, Rocket backpack |
| Legendary | Problem-solver crown |
| Six Seven | Six Seven specs |
| Never Gonna Give You Up | Retro pop pompadour, Retro headphones |
| Hackerman | Matrix shades |
| Perfectionist | Top knot, First-try bow tie |
| Flawless | Flawless silver |
| Untouchable | Superstar specs |
| Speed Demon | Lightning earrings |
| Marathon Runner | Marathon headband |
| Streak Starter | Streak ember |
| Committed | Streak flame |
| Unstoppable | Unstoppable wings |
| Night Owl | Night owl eyes, Night owl pal |
| Early Bird | Early bird nest |

## Artwork and validation

All artwork, thumbnails and the Three.js viewer are served locally under the
existing CSP. `frontend/js/vendor/avatar3d.bundle.js` is committed, so production
needs no compiler. Run `npm run build:avatar` after editing viewer code. WebGL
failure shows a static character render that cannot reflect every attribute.

See [the model workflow](../src/avatar-models/README.md) for editable Blender source
and regeneration. Blender is needed only for editing artwork, not for production.
Run `node --test src/tests/avatars.test.js src/tests/avatarStudio.test.js` for
account isolation, legacy migration, saved looks, unlock counters, slot coverage,
model fitting and distinct poses. Restart BITLab after deploying backend changes.
