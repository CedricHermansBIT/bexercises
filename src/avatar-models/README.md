# Original BITLab avatar models

`wardrobe.blend` is the editable Blender source. `build_avatar.py` generates the
rounded human models from Blender primitives: five face shapes, 16 hairstyles,
19 outfits, ten pants/skirt styles, ten shoe styles, hats/helmets, independent audio, jewellery, back gear and shoulder
companions. Each studio category has at least five visible actual choices. The full space suit
includes boots, gloves, seals, an oxygen hose and life-support backpack. This artwork was created for
BITLab; it does not contain GeoGuessr assets or downloaded character models.

Generated output lives in `frontend/assets/avatars/`:

- `wardrobe.glb`: self-contained glTF model, with modular group metadata.
- `character-*.png`, `hair-*.png`, `hat-*.png`, `outfit-*.png`,
  `pants-*.png`, `shoes-*.png`, `accessory-*.png`: local thumbnails.
- `color-*.png`: additional rendered color reference images.

Regenerate using Blender 4.5 LTS from the repository root:

```sh
blender --background --threads 4 --python src/avatar-models/build_avatar.py
npm run build:avatar
```

The script overwrites the generated model, thumbnails and editable project.
To keep manual Blender edits, export them directly instead of running the script.
Use glTF binary export with custom properties enabled. Preserve Empty group
properties `avatar_slot` and `avatar_id`, and preserve material names `Skin`,
`Hair`, `Wardrobe`, `Denim`, `Shoes`: the viewer uses these to toggle parts and
apply independent colors. Preserve the `avatar_covers_hair` hat property and `avatar_hide_outfits` mesh
property, which prevent hair and everyday limbs from poking through helmets and
suits. Keep all groups in the GLB; the viewer chooses which
parts to display. Accessories use the `none` selection by hiding all meshes.

Browser rendering uses Three.js under its MIT license, copied with the generated
bundle to `frontend/js/vendor/three.LICENSE.txt`. No Blender installation is
required on the production server.

Animation is procedural in the browser rather than baked into glTF clips.
`avatar_motion` identifies separate propeller, duck, bird, tassel, flame, wing,
head, blink, waist, shoulder, elbow, clothing sway, falling code and rocket jet pivots; `avatar_side` identifies left/right limbs.
`avatar_fit`, `avatar_hair_top` and `avatar_hair_width` support fitting headwear
and backpack clearance. Preserve these custom properties when exporting manual
edits. Child geometry must retain its rest transform relative to its pivot.
The viewer restores those transforms for reduced motion and hidden props.

For metadata or pivot-only edits, add `-- --skip-thumbnails` to the Blender command
to rebuild the GLB and editable project while keeping existing PNG renders.
`avatar_hide_hair` suppresses the hood beneath long hair without changing the
selected outfit.

Language mastery artwork includes a Python shoulder snake, Bash terminal backpack
and SQL database hat. New slot metadata is `audio`, `jewellery`, `back` and
`companion`; existing legacy thumbnail filenames are mapped by the renderer.
`-- --thumbnail-id=ITEM` (or comma-separated IDs) regenerates chosen thumbnails together with the model
and editable project. Preserve `avatar_hide_back` when exporting: replacement
backpacks hide the built-in space-suit oxygen pack.

Pants and shoes use independent `pants` / `shoes` slot groups. Their meshes carry
`avatar_hide_outfits` for the space suit. New tops participate in the same waist
and arm pivots as existing clothes. Matrix glyphs use `avatar_phase` and
`avatar_code_row` to loop within their lenses; thruster geometry pivots at each
nozzle so flickering does not move the attachment. Reduced motion restores all
rest transforms. The shared wardrobe has a 12 MiB asset budget.

Use `-- --thumbnail-missing` to render missing PNGs while rebuilding the model.
Pants/shoes thumbnails frame the lower body.

Dresses and the wizard robe own their bare legs and flared lower fabric; the
viewer hides the saved pants group while wearing them. Separate skirts use the
existing `pants` slot and `Denim` material for Bottom color. Their shells have
fabric thickness and shaped/pleated hems. Dress bodices and robe sleeves use
the existing articulated waist and elbow pivots.

Legacy accessory thumbnail filenames stay compatible after slot migrations. The
Blender selector maps these IDs to their current slots before rendering and
asserts that each rendered subject has visible geometry.

The ribbon wrap skirt has an outer overlap panel. Its bound edge and ribbon
tails follow the curved skirt surface with clearance for fabric thickness;
its waist tie is elliptical rather than a box intersecting the skirt.
