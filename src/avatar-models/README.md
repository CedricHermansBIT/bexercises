# Original BITLab avatar models

`wardrobe.blend` is the editable Blender source. `build_avatar.py` generates the
rounded human models from Blender primitives: four face shapes, six hairstyles,
four outfits, sneakers and three accessory meshes. This artwork was created for
BITLab; it does not contain GeoGuessr assets or downloaded character models.

Generated output lives in `frontend/assets/avatars/`:

- `wardrobe.glb`: self-contained glTF model, with modular group metadata.
- `character-*.png`, `hair-*.png`, `outfit-*.png`, `accessory-*.png`: local thumbnails.
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
apply independent colors. Keep all groups in the GLB; the viewer chooses which
parts to display. Accessories use the `none` selection by hiding all meshes.

Browser rendering uses Three.js under its MIT license, copied with the generated
bundle to `frontend/js/vendor/three.LICENSE.txt`. No Blender installation is
required on the production server.
