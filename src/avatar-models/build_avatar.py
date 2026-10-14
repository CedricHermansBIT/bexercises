"""Original modular human avatar. Run with Blender 4.5 LTS in background mode.
Exports an editable .blend, a shared GLB wardrobe and product thumbnails.
"""
import bpy, math, os
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'frontend/assets/avatars')
os.makedirs(OUT, exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)

def material(name, color, metallic=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=.68; bs.inputs['Metallic'].default_value=metallic
    return m
skin=material('Skin',(.67,.40,.25)); hair=material('Hair',(.10,.055,.035))
cloth=material('Wardrobe',(.12,.36,.72)); dark=material('Ink',(.055,.085,.14))
shoe=material('Shoes',(.92,.92,.85))
white=material('Cream',(.92,.92,.85)); denim=material('Denim',(.10,.16,.24))
gold=material('Gold',(.92,.57,.11),.3); sole=material('Sole',(.81,.83,.80)); eyes=material('Eyes',(.035,.035,.038))

def group(name,slot=None,item=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o)
    if slot: o['avatar_slot']=slot; o['avatar_id']=item
    return o
body=group('Body'); groups={}
def assign(obj,name,mat,parent):
    obj.name=name; obj.data.materials.append(mat); obj.parent=parent
    for p in obj.data.polygons: p.use_smooth=True
    return obj

def ellipsoid(name,loc,scale,mat,parent,segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=16,location=loc)
    o=bpy.context.object; o.scale=scale
    return assign(o,name,mat,parent)

def box(name,loc,scale,mat,parent,bevel=.08):
    bpy.ops.mesh.primitive_cube_add(size=2,location=loc); o=bpy.context.object; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    modifier=o.modifiers.new('Soft edges','BEVEL'); modifier.width=bevel; modifier.segments=3
    bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL'); bpy.ops.object.modifier_apply(modifier=modifier.name)
    return assign(o,name,mat,parent)

def limb(name,start,end,radius,mat,parent):
    start,end=Vector(start),Vector(end); mid=(start+end)/2
    bpy.ops.mesh.primitive_cylinder_add(vertices=20,radius=radius,depth=(end-start).length,location=mid)
    o=bpy.context.object; o.rotation_euler=(end-start).to_track_quat('Z','Y').to_euler(); assign(o,name,mat,parent)
    ellipsoid(name+' cap A',start,(radius,radius,radius),mat,parent,16)
    ellipsoid(name+' cap B',end,(radius,radius,radius),mat,parent,16)

def line(name,points,radius,mat,parent):
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=12; c.bevel_depth=radius; c.bevel_resolution=3
    s=c.splines.new('BEZIER'); s.bezier_points.add(len(points)-1)
    for p,loc in zip(s.bezier_points,points): p.co=loc; p.handle_left_type='AUTO'; p.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,c); bpy.context.collection.objects.link(o); o.data.materials.append(mat); o.parent=parent
    # Mesh conversion makes the editable curve export predictably to glTF.
    bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.convert(target='MESH'); o.select_set(False)
    return o

# A relaxed standing pose: oversized head, soft hands and chunky sneakers.
limb('Neck',(0,0,1.61),(0,0,1.81),.105,skin,body)
ellipsoid('Head',(0,0,2.02),(.355,.285,.385),skin,body)
for side in [-1,1]:
    ellipsoid('Ear',(side*.348,.015,2.0),(.058,.052,.087),skin,body)
    ellipsoid('Eye',(side*.117,-.274,2.055),(.026,.013,.04),eyes,body,16)
    line('Brow',[(side*.15,-.263,2.145),(side*.12,-.279,2.15),(side*.09,-.278,2.145)],.011,hair,body)
    limb('Arm',(side*.295,.0,1.55),(side*.455,-.01,1.065),.088,skin,body)
    ellipsoid('Hand',(side*.46,-.025,1.01),(.087,.085,.108),skin,body)
    ellipsoid('Thumb',(side*.395,-.075,1.03),(.04,.042,.065),skin,body,16)
    limb('Trouser leg',(side*.145,0,1.04),(side*.155,.018,.255),.123,denim,body)
    box('Sneaker',(side*.16,-.075,.13),(.13,.22,.11),shoe,body,.075)
    box('Shoe sole',(side*.16,-.077,.06),(.133,.223,.035),sole,body,.028)
    box('Sneaker accent',(side*.16,-.294,.135),(.065,.006,.023),cloth,body,.006)
ellipsoid('Nose',(0,-.286,1.98),(.053,.06,.063),skin,body,16)
line('Smile',[(-.075,-.27,1.9),(0,-.281,1.881),(.075,-.27,1.9)],.008,eyes,body)

# Independent face shapes keep characters distinct when hair/skin are customized.
face_parts=[o for o in body.children if o.name.startswith(('Head','Ear','Eye','Brow','Nose','Smile'))]
for key,sx,sz in [('robot',1,1),('sprout',1.055,1.015),('fox',.955,1.025),('cat',1.035,.965)]:
    g=group('Character_'+key,'character',key)
    for original in face_parts:
        o=original.copy(); o.data=original.data.copy(); bpy.context.collection.objects.link(o); o.parent=g
        o.location.x*=sx; o.location.z=2.02+(o.location.z-2.02)*sz; o.scale.x*=sx; o.scale.z*=sz
for original in face_parts: bpy.data.objects.remove(original,do_unlink=True)

# Independently selectable hairstyle groups.

for key in ['crop','curls','bob','bun','mohawk','braid']:
    g=group('Hair_'+key,'hair',key); groups[key]=g
    ellipsoid('Hair cap',(0,.026,2.256),(.35,.269,.185),hair,g)
    if key=='crop':
        for x,z,sx in [(-.16,2.29,.17),(.05,2.34,.20),(.22,2.3,.14)]:
            ellipsoid('Swept fringe',(x,-.178,z),(sx,.15,.10),hair,g)
        box('Sideburn left',(-.327,.007,2.13),(.025,.082,.10),hair,g,.024)
        box('Sideburn right',(.327,.007,2.13),(.025,.082,.10),hair,g,.024)
    elif key=='curls':
        for i in range(11):
            a=i*2*math.pi/11
            ellipsoid('Curl',(math.cos(a)*.26,math.sin(a)*.19,2.30+(.035 if i%2 else 0)),(.12,.105,.13),hair,g,16)
        for x in [-.17,0,.17]: ellipsoid('Top curl',(x,.01,2.43),(.13,.13,.11),hair,g,16)
    elif key=='bob':
        for x in [-.315,.315]: ellipsoid('Bob side',(x,.055,2.04),(.115,.20,.28),hair,g)
        for x in [-.19,0,.19]: ellipsoid('Bob fringe',(x,-.205,2.24),(.145,.10,.125),hair,g)
        ellipsoid('Bob back',(0,.18,2.05),(.34,.15,.25),hair,g)
    elif key=='bun':
        ellipsoid('Bun',(0,.165,2.45),(.16,.16,.16),hair,g)
        ellipsoid('Bun knot',(0,.17,2.56),(.08,.09,.075),hair,g,16)
        for x in [-.18,.18]: ellipsoid('Side fringe',(x,-.20,2.22),(.145,.095,.12),hair,g)

    elif key=='mohawk':
        for y,z in [(-.17,2.39),(-.055,2.51),(.055,2.53),(.17,2.44)]:
            ellipsoid('Crest',(0,y,z),(.070,.09,.15),hair,g,16)
    else:
        for index in range(7):
            z=2.17-index*.08; x=.04 if index%2 else -.04
            ellipsoid('Braid strand',(x,.285,z),(.075,.08,.068),hair,g,16)
        ellipsoid('Braid tie',(0,.282,1.62),(.06,.08,.025),cloth,g,16)

for key in ['tee','hoodie','lab-coat','space-suit']:
    g=group('Outfit_'+key,'outfit',key); groups[key]=g
    m=white if key in ['lab-coat','space-suit'] else cloth
    box('Torso',(0,.006,1.355),(.30,.165,.30 if key!='lab-coat' else .405),m,g,.12)
    for side in [-1,1]:
        end=(side*.335,0,1.44) if key=='tee' else (side*.44,-.01,1.105)
        limb('Sleeve',(side*.284,0,1.56),end,.10,m,g)
    if key=='tee':
        line('Neck trim',[(-.106,-.105,1.642),(0,-.165,1.63),(.106,-.105,1.642)],.018,white,g)
    elif key=='hoodie':
        ellipsoid('Hood',(0,.125,1.68),(.18,.18,.135),cloth,g)
        for x in [-.055,.055]: line('Drawstring',[(x,-.178,1.63),(x,-.177,1.47)],.012,white,g)
        box('Kangaroo pocket',(0,-.161,1.2),(.155,.027,.06),cloth,g,.035)
    elif key=='lab-coat':
        box('Inner shirt',(0,-.171,1.55),(.075,.012,.10),cloth,g,.012)
        for side in [-1,1]:
            lapel=box('Lapel',(side*.077,-.178,1.52),(.044,.012,.15),white,g,.007); lapel.rotation_euler[1]=side*.23
            box('Coat pocket',(side*.178,-.169,1.15),(.065,.015,.06),white,g,.018)
        line('Coat seam',[(0,-.171,1.40),(0,-.171,.977)],.007,sole,g)
    else:
        box('Suit control panel',(0,-.18,1.42),(.13,.032,.085),cloth,g,.022)
        for x in [-.07,0,.07]: ellipsoid('Panel light',(x,-.215,1.44),(.012,.008,.012),gold,g,12)
        box('Suit belt',(0,-.004,1.11),(.31,.176,.04),dark,g,.025)
        for side in [-1,1]: box('Knee armor',(side*.145,-.105,.58),(.118,.045,.10),white,g,.06)

for key in ['glasses','headphones','crown']:
    g=group('Accessory_'+key,'accessory',key); groups[key]=g
    if key=='glasses':
        for side in [-1,1]:
            x=side*.118
            points=[(x-.062,-.292,2.10),(x+.062,-.292,2.10),(x+.062,-.303,2.015),(x-.062,-.303,2.015),(x-.062,-.292,2.10)]
            line('Frame',points,.012,dark,g)
            line('Temple',[(side*.19,-.29,2.067),(side*.335,.015,2.067)],.01,dark,g)
        line('Bridge',[(-.054,-.307,2.06),(0,-.314,2.073),(.054,-.307,2.06)],.012,dark,g)
    elif key=='headphones':
        points=[(-.395,.015,2.02),(-.37,.02,2.31),(0,.02,2.49),(.37,.02,2.31),(.395,.015,2.02)]
        line('Headband',points,.029,dark,g)
        for side in [-1,1]:
            box('Ear cup',(side*.405,.012,2.03),(.055,.09,.105),dark,g,.045)
            box('Ear cup accent',(side*.456,.012,2.03),(.018,.06,.073),gold,g,.017)
    else:
        bpy.ops.mesh.primitive_torus_add(major_radius=.305,minor_radius=.035,major_segments=32,minor_segments=10,location=(0,0,2.435))
        assign(bpy.context.object,'Crown band',gold,g)
        for i in range(8):
            a=i*math.pi/4; x,y=math.cos(a)*.30,math.sin(a)*.30
            bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.060,radius2=.006,depth=.16,location=(x,y,2.52))
            assign(bpy.context.object,'Crown point',gold,g)

# Export wardrobe mesh groups in one file. The web viewer toggles groups by extras.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(bpy.context.scene.objects):
    if obj.type=='MESH': obj.select_set(True)
    elif obj.type=='EMPTY': obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'wardrobe.glb'),export_format='GLB',use_selection=True,export_extras=True)

# Shared studio lighting and thumbnails are generated in the same .blend source.
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.device='CPU'; scene.cycles.samples=16; scene.cycles.use_denoising=True
scene.render.resolution_x=360; scene.render.resolution_y=440; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
scene.world.color=(.4,.4,.4)
def area(name,loc,power,size):
    bpy.ops.object.light_add(type='AREA',location=loc); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK';o.data.size=size
    o.rotation_euler=(Vector((0,0,1.3))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-3,-4,5),450,4); area('Fill softbox',(3,-2,3),250,3); area('Rim softbox',(1,3,4),380,3)
bpy.ops.object.camera_add(location=(3.1,-6.8,3.05)); camera=bpy.context.object
camera.rotation_euler=(Vector((0,0,1.28))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO';camera.data.ortho_scale=3.05;scene.camera=camera
scene.view_settings.view_transform='Standard'
profiles={'robot':((.67,.40,.25),(.10,.055,.035)),'sprout':((.31,.17,.105),(.035,.025,.025)),'fox':((.88,.64,.46),(.23,.10,.055)),'cat':((.60,.42,.30),(.06,.065,.075))}
colors={'sky':(.12,.36,.72),'mint':(.10,.56,.40),'rose':(.74,.22,.40),'amber':(.87,.48,.12),'violet':(.43,.27,.73),'slate':(.25,.34,.45)}
def select(character='robot',outfit='tee',accessory='none',color='sky',hair_style=None):
    hair_style=hair_style or {'robot':'crop','sprout':'curls','fox':'bob','cat':'bun'}[character]
    for key,g in groups.items():
        shown=key in [hair_style,outfit,accessory]
        for o in g.children_recursive: o.hide_render=not shown
    for o in bpy.context.scene.objects:
        if o.get('avatar_slot')=='character':
            for child in o.children_recursive: child.hide_render=o.get('avatar_id')!=character
    for m,value in [(skin,profiles[character][0]),(hair,profiles[character][1]),(cloth,colors[color])]:
        m.diffuse_color=(*value,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*value,1)
for slot,ids in [('character',['robot','sprout','fox','cat']),('outfit',['tee','hoodie','lab-coat','space-suit']),('accessory',['none','glasses','headphones','crown']),('hair',['crop','curls','bob','bun','mohawk','braid']),('color',list(colors))]:
    for item in ids:
        args={'hair_style' if slot=='hair' else slot:item}; select(**args); scene.render.filepath=os.path.join(OUT,slot+'-'+item+'.png');bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0
select(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'src/avatar-models/wardrobe.blend'))
print('Saved original Blender wardrobe, GLB and modular thumbnails.')
