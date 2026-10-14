# Avatar studio

Every signed-in user can open **Character studio** from the top-right account
menu. Their equipped character replaces the person icon. Rankings show character
portraits; click a portrait or name to open a read-only profile with the full
rotatable character, exercises completed, test runs, achievements and points.
Online-user rows open the same profile. The admin user detail view places the
saved full character beside account information, above statistics and progress.
Admins have a
dashboard shortcut. User-management lists and activity reports show saved portraits,
including the selected student's activity header. The achievements page shows your
character with a studio link for equipping rewards. Earned achievement cards
show thumbnails and names of their unlocked character rewards. Selecting a reward
opens a read-only 3D preview of the item on its own, centred and fitted to view.
Wearable thumbnails also show only the item; colour rewards use swatches, while
character rewards show the character itself. Saving remains an explicit action
in the studio. Achievement popups use the same item-only reward previews; they
stack without overlapping, can be dismissed, and pause dismissal while hovered,
focused or inspecting an item. Unearned achievements do not reveal secret reward items. List portraits load near the
viewport and reuse the same cached renderer as account and ranking portraits. The old admin studio URL redirects to `/pages/avatar.html`.

Only equipped catalog IDs are shared in authenticated ranking and online-user responses.
Saved looks, unlocks and progress stay account-private. Students cannot include
admins in rankings or access other admin tools. One offscreen renderer generates
cached portraits as ranking rows approach the viewport, avoiding a WebGL context
and animation loop for every row. Devices without WebGL use local artwork.

## Wardrobe and preview

The studio has 200 choices across 18 categories. Every category has at least five
visible, actual choices, excluding “none” and secret rewards. Glasses, audio,
jewellery, back gear and shoulder companions are independent slots. Hats include
crowns. Colors, hair, clothing, face shape and personality can be mixed separately.
Pants and shoes have independent style and colour categories: ten pants/skirt styles
and ten shoe styles, including shorts, cargo trousers, joggers, high-tops,
boots, sandals and clogs. Older equipped characters and saved looks retain
classic trousers and sneakers; older clients preserve newly equipped styles.
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

Mix lab goggles and clogs with the lab coat, a raised welding visor with workshop
dungarees and boots, or the chef jacket and toque with clogs. Halloween pumpkin
knits/hats and Christmas knits/Santa hats/elf shoes unlock through achievements
year-round. Pieces remain independent; there is no date restriction or bundle lock.

Dresses include a ribbon sundress, campus pinafore, tiered party dress and
starlight dress. Pair separate pleated, button-front, wrap or tulle skirts with
any top; ballet flats and Mary Janes complete the look. Dress colours use Top
color, separate skirts use Bottom color. Dresses cover your saved bottoms and
restore them when changing tops. Choosing separate bottoms switches a dress to
a tee. Shoes stay independent. All characters can wear every style.

Chapter Master also unlocks a long wizard robe with wide cuffs and gold trim,
which pairs with the existing Chapter Wizard hat. It covers saved bottoms in
the same way as dresses.

## Personality

Seven idle personalities have distinct silhouettes: relaxed, hands-on-hips
confidence, shy folded arms, happy bouncing, sleepy nodding with closed eyes,
a curious thinking pose, and a headphone groove.
Eight celebrations use articulated shoulders, elbows and a waist: a one-handed
wave, overhead victory cheer, happy hopping, alternating-arm dance, a waist bow, a salute, a victory dab,
and clapping. Hand targets drive the shoulder and elbow together: the dab
extends one arm and folds the other across the face, the cheer reaches overhead,
and the salute reaches the forehead. Gesture reach lengthens arm segments while
preserving hand size and sleeve width; all transforms return to rest afterward.
Select a favourite celebration and use **Celebrate** to play it. Personality and
celebration are saved with the equipped avatar and each named look.

The propeller spins, wings flap, ducks bob, birds hop, tassels sway, flames flicker
and decorative accents pulse. Matrix glasses display falling green binary code;
rocket exhaust flickers from fixed nozzles. Hoodie and raincoat drawstrings,
bomber zipper pulls and the Santa pompom sway. Reduced motion keeps the selected
static personality
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
`companion`, `idle`, `celebration`, `pants` and `shoes`. Legacy four-, nine-, ten-
and sixteen-field selections
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
| First Steps | Lab coat, Lab safety goggles, Lab & kitchen clogs, First-step star pin |
| Chapter Master | Chapter wizard, Scholar bookbag, Chapter varsity jacket, Starlight dress, Wizard robe |
| Complete Mastery | Graduation cap |
| Comeback Kid | Comeback crest |
| Persistent | Focus headphones, Workshop welding visor |
| Never Give Up | Never-give-up Viking, Slow-and-steady shell |
| Quick Learner | Robin, Curious cat pal, Learner gold, Party dress |
| Dedicated | Sage, Explorer braid, Studio headset, Rainy-day explorer, Tulle skirt |
| Master | Space suit, Space helmet, Rocket backpack |
| Legendary | Problem-solver crown |
| Six Seven | Six Seven specs |
| Never Gonna Give You Up | Retro pop pompadour, Retro headphones |
| Hackerman | Matrix shades |
| Perfectionist | Top knot, First-try bow tie, Chef’s double-breasted jacket, Chef’s toque |
| Flawless | Flawless silver |
| Untouchable | Superstar specs |
| Speed Demon | Lightning earrings |
| Marathon Runner | Marathon headband |
| Streak Starter | Streak ember, Streak-season festive knit |
| Committed | Streak flame, Committed Claus hat, Curly elf shoes |
| Unstoppable | Unstoppable wings |
| Night Owl | Night owl eyes, Night owl pal, Midnight pumpkin jumper, Little pumpkin patch hat |
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
