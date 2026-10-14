# Original BITLab avatar models

`wardrobe.blend` is the editable Blender source. `build_avatar.py` generates the
rounded human models from Blender primitives: four face shapes, 16 hairstyles,
four outfits, 14 hat/helmet meshes and 13 accessory meshes. The full space suit
includes boots, gloves, seals, an oxygen hose and life-support backpack. This artwork was created for
BITLab; it does not contain GeoGuessr assets or downloaded character models.

Generated output lives in `frontend/assets/avatars/`:

- `wardrobe.glb`: self-contained glTF model, with modular group metadata.
- `character-*.png`, `hair-*.png`, `hat-*.png`, `outfit-*.png`, `accessory-*.png`: local thumbnails.
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
head, blink and shoulder pivots; `avatar_side` identifies left/right limbs.
`avatar_fit`, `avatar_hair_top` and `avatar_hair_width` support fitting headwear
and backpack clearance. Preserve these custom properties when exporting manual
edits. Child geometry must retain its rest transform relative to its pivot.
The viewer restores those transforms for reduced motion and hidden props.

For metadata or pivot-only edits, add `-- --skip-thumbnails` to the Blender command
to rebuild the GLB and editable project while keeping existing PNG renders.
`avatar_hide_hair` suppresses the hood beneath long hair without changing the
selected outfit.
