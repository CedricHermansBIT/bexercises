"""Original modular human avatar. Run with Blender 4.5 LTS in background mode.
Exports an editable .blend, a shared GLB wardrobe and product thumbnails.
"""
import bpy, math, os, sys
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../..'))
OUT = os.path.join(ROOT, 'frontend/assets/avatars')
os.makedirs(OUT, exist_ok=True)
THUMBNAIL_ONLY=next((a.split('=',1)[1] for a in sys.argv if a.startswith('--thumbnail-id=')),None)
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
ITEM_SLOTS={'headphones':'audio','crown':'hat','lightning':'jewellery','bow-tie':'jewellery','language-medal':'jewellery','wings':'back'}
HAIRS=['crop','curls','bob','bun','mohawk','braid','bald','buzz','pixie','afro','ponytail','twin-buns','spiky','long-waves','dreads','pompadour']
ACCESSORIES=['glasses','headphones','crown','glasses-69','glasses-67','star-glasses','pixel-shades','owl-glasses','lightning','bow-tie','wings','language-medal','matrix-shades']
HATS=['cap','beanie','duck','propeller','wizard','graduation','space-helmet','viking','centurion-helmet','mushroom','top-hat','runner','early-bird-hat','flame','database-hat']
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
    c=bpy.data.curves.new(name,'CURVE'); c.dimensions='3D'; c.resolution_u=3; c.bevel_depth=radius; c.bevel_resolution=2
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
    limb('Arm',(side*.295,.0,1.55),(side*.385,0,1.285),.088,skin,body)
    limb('Forearm',(side*.385,0,1.285),(side*.455,-.01,1.065),.087,skin,body)
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
for key,sx,sz in [('robot',1,1),('sprout',1.055,1.015),('fox',.955,1.025),('cat',1.035,.965),('nova',.90,1.10)]:
    g=group('Character_'+key,'character',key)
    for original in face_parts:
        o=original.copy(); o.data=original.data.copy(); bpy.context.collection.objects.link(o); o.parent=g
        o.location.x*=sx; o.location.z=2.02+(o.location.z-2.02)*sz; o.scale.x*=sx; o.scale.z*=sz
for original in face_parts: bpy.data.objects.remove(original,do_unlink=True)

# Independently selectable hairstyle groups.

for key in HAIRS:
    g=group('Hair_'+key,'hair',key); groups[key]=g
    if key not in ['bald','buzz']: ellipsoid('Hair cap',(0,.026,2.256),(.35,.269,.185),hair,g)
    if key=='buzz': ellipsoid('Buzz cap',(0,.022,2.235),(.344,.266,.15),hair,g)
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
    elif key=='braid':
        for index in range(7):
            z=2.17-index*.08; x=.04 if index%2 else -.04
            ellipsoid('Braid strand',(x,.285,z),(.075,.08,.068),hair,g,16)
        ellipsoid('Braid tie',(0,.282,1.62),(.06,.08,.025),cloth,g,16)

    elif key=='pixie':
        for x,z in [(-.22,2.26),(-.06,2.31),(.10,2.28)]:
            ellipsoid('Pixie fringe',(x,-.19,z),(.13,.095,.10),hair,g)
    elif key=='afro':
        for row,z,r in [(0,2.24,.35),(1,2.43,.29),(2,2.57,.16)]:
            for i in range(10):
                a=i*math.pi/5+row*.15
                ellipsoid('Afro curl',(math.cos(a)*r,math.sin(a)*r*.8,z),(.145,.13,.145),hair,g,16)
        ellipsoid('Cloud top',(0,0,2.62),(.15,.14,.14),hair,g,16)
    elif key=='ponytail':
        for i in range(5): ellipsoid('Ponytail',(0,.32+i*.025,2.28-i*.115),(.11,.095,.11),hair,g,16)
        ellipsoid('Ponytail tie',(0,.30,2.32),(.13,.05,.08),cloth,g)
    elif key=='twin-buns':
        for side in [-1,1]:
            ellipsoid('Twin bun',(side*.30,.05,2.42),(.145,.14,.145),hair,g)
            ellipsoid('Bun ribbon',(side*.30,-.02,2.42),(.15,.022,.032),cloth,g)
    elif key=='spiky':
        for x,y,z in [(-.23,-.07,2.40),(-.10,-.15,2.49),(.04,-.02,2.54),(.20,-.10,2.44),(0,.18,2.48)]:
            bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.105,radius2=.005,depth=.28,location=(x,y,z))
            assign(bpy.context.object,'Spike',hair,g)
    elif key=='long-waves':
        for side in [-1,1]:
            for i in range(5):
                ellipsoid('Wave',(side*(.31+.025*math.sin(i)),.08,2.16-i*.11),(.12,.18,.145),hair,g)
        ellipsoid('Wavy back',(0,.20,1.98),(.32,.15,.35),hair,g)
        ellipsoid('Swept bang',(-.12,-.21,2.28),(.24,.09,.10),hair,g)
    elif key=='dreads':
        for i in range(12):
            a=i*2*math.pi/12; x,y=math.cos(a)*.32,math.sin(a)*.24
            if y<-.10: end=2.19
            else: end=1.75
            line('Loc',[(x*.7,y*.7,2.37),(x,y,2.22),(x*1.08,y*1.1,end)],.042,hair,g)
    elif key=='pompadour':
        ellipsoid('Retro quiff',(0,-.12,2.42),(.32,.22,.21),hair,g)
        for side in [-1,1]: box('Retro sideburn',(side*.326,0,2.07),(.032,.075,.13),hair,g,.022)

for key in ['tee','hoodie','lab-coat','space-suit','dungarees']:
    g=group('Outfit_'+key,'outfit',key); groups[key]=g
    m=white if key in ['lab-coat','space-suit'] else cloth
    box('Torso',(0,.006,1.355),(.30,.165,.30 if key!='lab-coat' else .405),m,g,.12)
    for side in [-1,1]:
        end=(side*.335,0,1.44) if key=='tee' else (side*.44,-.01,1.105)
        if key=='tee': limb('Sleeve',(side*.284,0,1.56),end,.10,m,g)
        else:
            limb('Sleeve',(side*.284,0,1.56),(side*.385,0,1.285),.10,m,g)
            limb('Sleeve forearm',(side*.385,0,1.285),end,.10,m,g)
    if key=='tee':
        line('Neck trim',[(-.106,-.105,1.642),(0,-.165,1.63),(.106,-.105,1.642)],.018,white,g)
    elif key=='hoodie':
        hood=ellipsoid('Hood',(0,.125,1.68),(.18,.18,.135),cloth,g)
        hood['avatar_hide_hair']=['bob','braid','long-waves','dreads']
        for x in [-.055,.055]: line('Drawstring',[(x,-.178,1.63),(x,-.177,1.47)],.012,white,g)
        box('Kangaroo pocket',(0,-.161,1.2),(.155,.027,.06),cloth,g,.035)
    elif key=='dungarees':
        box('Overall bib',(0,-.184,1.28),(.22,.025,.19),denim,g,.05)
        for side in [-1,1]:
            box('Suspender',(side*.15,-.175,1.51),(.035,.018,.15),denim,g,.01)
            ellipsoid('Overall button',(side*.15,-.203,1.37),(.018,.007,.018),gold,g,12)
        box('Bib pocket',(0,-.216,1.26),(.10,.012,.06),denim,g,.018)
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
        box('Life support backpack',(0,.235,1.43),(.25,.12,.28),white,g,.09)
        box('Oxygen pack stripe',(0,.36,1.43),(.19,.025,.045),cloth,g,.015)
        for side in [-1,1]:
            limb('Pressurized leg',(side*.145,0,1.08),(side*.155,.018,.24),.145,white,g)
            box('Knee armor',(side*.145,-.13,.58),(.125,.04,.085),dark,g,.045)
            box('Moon boot',(side*.16,-.075,.145),(.15,.24,.13),white,g,.065)
            box('Boot tread',(side*.16,-.075,.045),(.157,.247,.036),dark,g,.02)
            ellipsoid('Pressure glove',(side*.46,-.025,1.01),(.10,.10,.125),white,g)
            ellipsoid('Glove thumb',(side*.395,-.075,1.03),(.046,.048,.073),white,g,16)
            limb('Suit wrist seal',(side*.43,-.01,1.14),(side*.455,-.018,1.07),.108,dark,g)
            limb('Shoulder armor',(side*.284,0,1.56),(side*.32,0,1.48),.125,white,g)
            box('Mission patch',(side*.29,-.104,1.55),(.035,.016,.032),cloth,g,.012)
        line('Oxygen hose',[(-.15,-.21,1.36),(-.28,-.24,1.22),(-.32,-.08,1.15),(-.30,.21,1.28)],.025,gold,g)
        line('Pressure collar',[(-.12,0,1.69),(-.10,-.11,1.70),(0,-.15,1.70),(.10,-.11,1.70),(.12,0,1.69)],.032,dark,g)
# Hide the everyday limbs and shoes inside the fully pressurized suit.
for o in body.children:
    if o.name.startswith(('Arm','Forearm','Hand','Thumb','Trouser','Sneaker','Shoe sole')): o['avatar_hide_outfits']=['space-suit']

for key in ['glasses','headphones','crown']:
    g=group('Accessory_'+key,ITEM_SLOTS.get(key,'accessory'),key); groups[key]=g
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


def ring(name,loc,rx,rz,mat,parent,radius=.014):
    x,y,z=loc
    points=[(x+rx*math.cos(i*math.pi/16),y,z+rz*math.sin(i*math.pi/16)) for i in range(33)]
    return line(name,points,radius,mat,parent)
def torus(name,loc,major,minor,mat,parent):
    bpy.ops.mesh.primitive_torus_add(major_radius=major,minor_radius=minor,major_segments=32,minor_segments=10,location=loc)
    return assign(bpy.context.object,name,mat,parent)
def cone(name,loc,r1,r2,depth,mat,parent,vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=loc)
    return assign(bpy.context.object,name,mat,parent)
def text_mesh(name,value,loc,size,mat,parent,center=False):
    bpy.ops.object.text_add(location=loc); o=bpy.context.object; o.data.body=value; o.data.size=size
    o.data.align_x='CENTER' if center else 'LEFT'; o.data.extrude=.007; o.data.bevel_depth=.003; o.rotation_euler[0]=math.pi/2
    bpy.ops.object.convert(target='MESH'); return assign(bpy.context.object,name,mat,parent)
ruby=material('Ruby',(.8,.045,.075)); emerald=material('Emerald',(.035,.55,.24))
visor=material('Visor',(.82,.54,.11),.25)
visor.diffuse_color=(.82,.54,.11,.22); visor.node_tree.nodes.get('Principled BSDF').inputs['Alpha'].default_value=.22
visor.surface_render_method='DITHERED'
for key in ACCESSORIES:
    if key in ['glasses','headphones','crown']: continue
    g=group('Accessory_'+key,ITEM_SLOTS.get(key,'accessory'),key); groups[key]=g
    if key in ['glasses-69','glasses-67']:
        text_mesh('Novelty number frames','69' if key=='glasses-69' else '67',(0,-.335,1.967),.34,gold if key=='glasses-69' else cloth,g,center=True)
    elif key=='star-glasses':
        for side in [-1,1]:
            points=[]
            for i in range(11):
                a=math.pi/2+i*math.pi/5; r=.105 if i%2==0 else .052
                points.append((side*.12+math.cos(a)*r,-.335,2.07+math.sin(a)*r))
            line('Star frame',points,.013,gold,g)
    elif key in ['pixel-shades','matrix-shades']:
        for side in [-1,1]:
            x=side*.12
            for dx,z,w,h in [(0,2.14,.10,.023),(0,2.00,.10,.023),(-.08,2.07,.023,.065),(.08,2.07,.023,.065)]:
                box('Pixel frame',(x+dx,-.332,z),(w,.012,h),emerald if key=='matrix-shades' else dark,g,.002)
            if key=='matrix-shades':
                box('Matrix lens',(x,-.33,2.07),(.065,.009,.047),dark,g,.001)
                for dx in [-.04,0,.04]: box('Code glint',(x+dx,-.346,2.085),(.005,.003,.015),emerald,g,.001)
    elif key=='owl-glasses':
        for side in [-1,1]:
            ring('Owl eye',(side*.13,-.34,2.07),.108,.106,gold,g,.018)
            line('Owl feather',[(side*.22,-.335,2.13),(side*.24,-.32,2.23),(side*.15,-.335,2.17)],.015,gold,g)
    elif key=='lightning':
        for side in [-1,1]:
            line('Lightning earring',[(side*.40,-.02,2.00),(side*.37,-.02,1.94),(side*.42,-.02,1.95),(side*.38,-.02,1.86)],.014,gold,g)
    elif key=='bow-tie':
        for side in [-1,1]: ellipsoid('Bow wing',(side*.068,-.19,1.63),(.07,.035,.044),ruby,g)
        ellipsoid('Bow knot',(0,-.21,1.63),(.032,.026,.032),gold,g,16)
    elif key=='wings':
        for side in [-1,1]:
            for i in range(5):
                o=ellipsoid('Wing feather',(side*(.35+i*.095),.22,1.43+i*.075),(.09,.055,.30-i*.025),white,g)
                o.rotation_euler[1]=side*(.45+i*.16)
    elif key=='language-medal':
        line('Medal ribbon',[(-.1,-.16,1.67),(0,-.215,1.28),(.1,-.16,1.67)],.018,cloth,g)
        ellipsoid('Language medal',(0,-.23,1.27),(.08,.025,.09),gold,g)
        text_mesh('Code medal','<>',(-.05,-.261,1.24),.075,dark,g)
    if key in ['glasses-69','glasses-67','star-glasses','pixel-shades','owl-glasses','matrix-shades']:
        line('Novelty bridge',[(-.04,-.34,2.07),(0,-.35,2.085),(.04,-.34,2.07)],.012,dark,g)
        for side in [-1,1]: line('Novelty temple',[(side*.21,-.32,2.08),(side*.34,.02,2.08)],.012,dark,g)

for key in HATS:
    g=group('Hat_'+key,'hat',key); groups[key]=g
    g['avatar_covers_hair']=key not in ['runner','early-bird-hat']
    if key in ['cap','beanie','propeller','duck','flame']:
        ellipsoid('Hat dome',(0,.02,2.30),(.375,.30,.16),cloth,g)
        if key=='cap': ellipsoid('Cap brim',(0,-.29,2.27),(.27,.23,.032),cloth,g)
        elif key=='beanie':
            torus('Beanie cuff',(0,.02,2.27),.31,.045,cloth,g)
            ellipsoid('Beanie pom',(0,.02,2.49),(.075,.075,.075),white,g)
        elif key=='propeller':
            limb('Propeller spindle',(0,.02,2.43),(0,.02,2.62),.02,gold,g)
            box('Propeller blades',(0,.02,2.62),(.34,.045,.012),ruby,g,.012)
            box('Propeller blades cross',(0,.02,2.625),(.045,.25,.012),gold,g,.012)
            text_mesh('42 badge','42',(-.09,-.291,2.29),.15,white,g)
        elif key=='duck':
            ellipsoid('Duck body',(0,.01,2.55),(.16,.13,.11),gold,g)
            ellipsoid('Duck head',(0,-.08,2.67),(.085,.085,.09),gold,g)
            box('Duck beak',(0,-.17,2.65),(.06,.055,.025),ruby,g,.018)
            for side in [-1,1]: ellipsoid('Duck eye',(side*.051,-.145,2.70),(.011,.012,.013),eyes,g,12)
            ellipsoid('Duck tail',(0,.13,2.58),(.06,.09,.05),gold,g)
        elif key=='flame':
            cone('Flame core',(0,.02,2.59),.13,.005,.42,ruby,g)
            cone('Golden flame',(0,-.065,2.55),.075,.003,.30,gold,g)
    elif key=='wizard':
        ellipsoid('Wizard brim',(0,0,2.32),(.50,.40,.035),cloth,g)
        cone('Wizard cone',(0,.03,2.65),.33,.01,.65,cloth,g)
        for x,z in [(-.12,2.46),(.06,2.58),(0,2.76)]:
            ellipsoid('Wizard star',(x,-.25+(z-2.4)*.35,z),(.025,.012,.025),gold,g,12)
    elif key=='graduation':
        cone('Graduate cap',(0,0,2.30),.31,.31,.17,dark,g)
        board=box('Mortarboard',(0,0,2.42),(.38,.32,.022),dark,g,.008); board.rotation_euler[2]=.2
        line('Tassel',[(0,0,2.46),(.32,-.23,2.46),(.37,-.25,2.20)],.012,gold,g)
        for x in [.355,.37,.385]: limb('Tassel strand',(x,-.25,2.20),(x,-.25,2.13),.008,gold,g)
    elif key=='space-helmet':
        # Open-front shell, large face window, visor and pressure collar.
        vertices=[]; faces=[]
        for row in range(17):
            t=row*math.pi/16
            for col in range(25):
                a=col*math.pi/24
                vertices.append((.46*math.sin(t)*math.cos(a),.40*math.sin(t)*math.sin(a)+.01,2.06+.49*math.cos(t)))
        for row in range(16):
            for col in range(24):
                i=row*25+col;faces.append((i,i+1,i+26,i+25))
        mesh=bpy.data.meshes.new('Helmet shell');mesh.from_pydata(vertices,[],faces);mesh.update()
        o=bpy.data.objects.new('Helmet shell',mesh);bpy.context.collection.objects.link(o);assign(o,'Helmet shell',white,g)
        ring('Helmet window rim',(0,-.025,2.06),.46,.49,white,g,.048)
        ellipsoid('Golden visor',(0,-.11,2.06),(.42,.30,.445),visor,g)
        for side in [-1,1]: ellipsoid('Helmet hinge',(side*.48,0,2.03),(.04,.075,.075),dark,g)
        torus('Pressure neck ring',(0,0,1.66),.17,.045,dark,g)
        box('Helmet chin plate',(0,-.16,1.61),(.23,.08,.04),white,g,.025)
    elif key in ['viking','centurion-helmet']:
        ellipsoid('Warrior dome',(0,.02,2.30),(.375,.30,.17),sole,g)
        torus('Helmet band',(0,.02,2.28),.32,.038,gold,g)
        if key=='viking':
            for side in [-1,1]: line('Viking horn',[(side*.32,.01,2.34),(side*.48,.01,2.45),(side*.53,.01,2.66)],.045,white,g)
        else:
            for y in [-.18,-.09,0,.09,.18]: box('Roman crest',(0,y,2.54),(.04,.075,.16),ruby,g,.025)
    elif key=='mushroom':
        cone('Mushroom stem',(0,0,2.36),.27,.27,.22,white,g)
        ellipsoid('Mushroom cap',(0,0,2.51),(.49,.40,.20),ruby,g)
        for x,y,z in [(-.25,-.18,2.62),(.19,-.25,2.60),(0,0,2.71),(.30,.09,2.60),(-.20,.20,2.64)]:
            ellipsoid('Mushroom spot',(x,y,z),(.06,.06,.015),white,g,16)
    elif key=='top-hat':
        ellipsoid('Top hat brim',(0,0,2.28),(.45,.36,.035),dark,g)
        cone('Top hat',(0,0,2.51),.30,.32,.43,dark,g)
        cone('Top hat ribbon',(0,0,2.36),.305,.307,.065,cloth,g)
        text_mesh('Thousandaire badge','$',(-.055,-.316,2.40),.18,gold,g)
    elif key=='runner':
        band=torus('Sweatband',(0,0,2.19),.35,.022,cloth,g); band.scale.y=.80
    elif key=='database-hat':
        for z in [2.30,2.45,2.60]:
            cone('Database tier',(0,0,z),.34,.34,.13,cloth,g)
            torus('Database rim',(0,0,z+.055),.32,.018,white,g)
        text_mesh('SQL label','SQL',(-.14,-.343,2.46),.15,white,g)
    elif key=='early-bird-hat':
        for z in [2.40,2.43,2.46]: torus('Nest',(0,.06,z),.15,.025,hair,g)
        ellipsoid('Bird body',(0,.02,2.56),(.095,.08,.09),cloth,g)
        ellipsoid('Bird head',(0,-.04,2.66),(.06,.06,.06),cloth,g)
        cone('Bird beak',(0,-.108,2.64),.035,.002,.065,gold,g).rotation_euler[0]=math.pi/2
        for side in [-1,1]: ellipsoid('Bird eye',(side*.035,-.087,2.68),(.009,.009,.009),eyes,g,12)

# Language mastery rewards, each attached to its own independent slot.
g=group('Companion_python','companion','python-snake');groups['python-snake']=g
line('Snake coils',[(-.32,.03,1.67),(-.40,-.04,1.73),(-.30,-.09,1.78),(-.23,-.02,1.73),(-.29,.07,1.79),(-.49,.05,1.89)],.043,emerald,g)
ellipsoid('Snake head',(-.49,.045,1.94),(.065,.065,.075),emerald,g)
for x in [-.515,-.465]: ellipsoid('Snake eye',(x,-.012,1.97),(.009,.01,.012),eyes,g,12)
line('Snake smile',[(-.51,-.02,1.92),(-.49,-.028,1.915),(-.47,-.02,1.92)],.004,eyes,g)
g['avatar_motion']='snake'
g=group('Back_terminal','back','terminal-pack');groups['terminal-pack']=g
box('Terminal shell',(0,.31,1.38),(.27,.14,.28),dark,g,.09)
box('Terminal screen',(0,.455,1.43),(.21,.018,.16),eyes,g,.022)
label=text_mesh('Terminal prompt','$ _',(.13,.48,1.45),.17,emerald,g);label.rotation_euler[2]=math.pi
for x in [-.12,-.04,.04,.12]: box('Terminal key',(x,.47,1.20),(.022,.012,.014),cloth,g,.005)
for side in [-1,1]: line('Backpack strap',[(side*.22,.25,1.63),(side*.21,-.17,1.64),(side*.22,-.185,1.13),(side*.22,.23,1.14)],.018,cloth,g)
for o in groups['space-suit'].children:
    if o.name.startswith(('Life support backpack','Oxygen pack stripe','Oxygen hose')): o['avatar_hide_back']=['terminal-pack']

# Additional distinct audio, back and companion choices.
for key in ['studio-headset','cat-headphones','earbuds','retro-headphones','gamer-headset']:
    g=group('Audio_'+key,'audio',key);groups[key]=g
    if key!='earbuds':
        band=line('Audio arch',[(-.40,.015,2.02),(-.37,.02,2.31),(0,.02,2.49),(.37,.02,2.31),(.40,.015,2.02)],.035,dark if key!='retro-headphones' else cloth,g)
        pivot_stub=group('Audio_fit_arch');pivot_stub.parent=g;pivot_stub.location=(0,0,2.02)
        bpy.context.view_layer.update();matrix=band.matrix_world.copy();band.parent=pivot_stub;band.matrix_world=matrix;pivot_stub['avatar_fit']='headband'
    for side in [-1,1]:
        if key=='earbuds':
            ear=ellipsoid('Earbud',(side*.39,-.005,2.0),(.033,.040,.040),white,g,16)
            limb('Earbud stem',(side*.39,-.01,1.99),(side*.39,-.01,1.92),.015,white,g)
        elif key=='gamer-headset':
            ear=cone('Gaming ear cup',(side*.42,.01,2.03),.115,.115,.08,dark,g,6);ear.rotation_euler[1]=math.pi/2
            for z in [1.97,2.03,2.09]: box('RGB light',(side*.469,.01,z),(.008,.052,.01),emerald if z==2.03 else cloth,g,.002)
        elif key=='retro-headphones':
            ear=ellipsoid('Retro ear cup',(side*.42,.01,2.02),(.045,.10,.10),cloth,g)
            ellipsoid('Retro disc',(side*.46,.01,2.02),(.01,.055,.055),white,g)
        else:
            ear=box('Studio ear cup',(side*.42,.012,2.03),(.06,.095,.11),dark,g,.045)
            box('Studio accent',(side*.477,.012,2.03),(.012,.06,.075),cloth,g,.01)
        if key!='earbuds': ear['avatar_fit']='earcup';ear['avatar_side']=side
    if key=='studio-headset': line('Mic boom',[(.43,-.06,1.99),(.37,-.27,1.89),(.16,-.32,1.87)],.014,dark,g)
    for detail in g.children:
        if detail.name.startswith(('Studio accent','Retro disc','RGB light')): detail['avatar_fit']='earcup';detail['avatar_side']=1 if detail.location.x>0 else -1
        if detail.name.startswith('Mic boom'): detail['avatar_hide_hair']=['afro']
    if key=='cat-headphones':
        for side in [-1,1]:
            cone('Headphone cat ear',(side*.27,.02,2.51),.10,.004,.20,cloth,g,3)

for key in ['rocket-pack','bookbag','turtle-shell']:
    g=group('Back_'+key,'back',key);groups[key]=g
    if key=='rocket-pack':
        box('Rocket harness',(0,.29,1.4),(.27,.05,.23),dark,g,.05)
        for side in [-1,1]:
            cone('Rocket tank',(side*.15,.36,1.44),.11,.11,.50,white,g)
            ellipsoid('Rocket cap',(side*.15,.36,1.72),(.11,.11,.12),cloth,g)
            cone('Rocket nozzle',(side*.15,.36,1.15),.055,.09,.11,dark,g)
            cone('Rocket exhaust',(side*.15,.36,.98),.003,.065,.24,gold,g)['avatar_motion']='flame'
    elif key=='bookbag':
        box('Bookbag',(0,.30,1.38),(.26,.14,.29),cloth,g,.09)
        box('Bag flap',(0,.455,1.54),(.24,.023,.095),denim,g,.04)
        box('Bookbag pocket',(0,.457,1.24),(.15,.028,.085),denim,g,.04)
        for x in [-.13,.13]: box('Buckle',(x,.485,1.43),(.023,.012,.04),gold,g,.005)
    else:
        ellipsoid('Turtle shell',(0,.33,1.4),(.31,.18,.38),emerald,g)
        line('Shell middle',[(0,.51,1.73),(0,.52,1.4),(0,.50,1.08)],.014,gold,g)
        for z in [1.2,1.4,1.6]: line('Shell seam',[(-.25,.44,z),(0,.52,z),(.25,.44,z)],.012,gold,g)
    for side in [-1,1]: line('Gear strap',[(side*.22,.25,1.63),(side*.21,-.17,1.64),(side*.22,-.18,1.13),(side*.22,.23,1.14)],.018,cloth,g)
for key in ['owl-pal','duck-pal','robot-pal','cat-pal']:
    g=group('Pal_'+key,'companion',key);groups[key]=g;g['avatar_motion']='snake'
    x=-.49; y=.02
    if key=='duck-pal':
        for original in groups['duck'].children:
            if original.name.startswith('Duck '):
                o=original.copy();o.data=original.data.copy();bpy.context.collection.objects.link(o);o.parent=g
                o.location.x+=x;o.location.z-=.70
    elif key=='robot-pal':
        box('Robot body',(x,y,1.75),(.06,.06,.065),cloth,g,.018)
        box('Robot head',(x,y,1.88),(.08,.07,.07),white,g,.026)
        for dx in [-.035,.035]: ellipsoid('Robot eye',(x+dx,-.052,1.89),(.012,.008,.015),emerald,g,12)
        limb('Robot antenna',(x,y,1.96),(x,y,2.02),.008,gold,g)
        ellipsoid('Antenna tip',(x,y,2.025),(.019,.019,.019),gold,g,12)
    else:
        ellipsoid('Pal body',(x,y,1.76),(.08,.07,.09),hair if key=='cat-pal' else gold,g)
        ellipsoid('Pal head',(x,y,1.90),(.095,.075,.085),hair if key=='cat-pal' else gold,g)
        for dx in [-.04,.04]:
            ellipsoid('Pal eye white',(x+dx,-.05,1.92),(.03,.012,.03),white,g,16)
            ellipsoid('Pal pupil',(x+dx,-.064,1.92),(.012,.008,.016),eyes,g,12)
        if key=='cat-pal':
            for dx in [-.06,.06]: cone('Pal cat ear',(x+dx,y,1.99),.039,.002,.09,hair,g,3)
            line('Pal tail',[(x+.04,.07,1.72),(x+.11,.08,1.78),(x+.12,.03,1.81)],.015,hair,g)
        else:
            cone('Owl beak',(x,-.07,1.875),.018,.002,.03,ruby,g,3).rotation_euler[0]=math.pi/2
            for dx in [-.09,.09]: ellipsoid('Owl wing',(x+dx,y,1.78),(.025,.06,.065),white,g)
for key in ['star-pin','scarf']:
    g=group('Jewellery_'+key,'jewellery',key);groups[key]=g
    if key=='star-pin':
        for i in range(5):
            a=i*2*math.pi/5;limb('Star pin ray',(.17,-.20,1.43),(.17+.045*math.cos(a),-.20,1.43+.045*math.sin(a)),.014,gold,g)
    else:
        torus('Scarf collar',(0,0,1.66),.15,.04,cloth,g)
        box('Scarf tail',(.08,-.21,1.50),(.045,.022,.15),cloth,g,.02)
        for z in [1.44,1.50,1.56]: box('Scarf stripe',(.08,-.235,z),(.046,.004,.012),white,g,.004)
for o in groups['space-suit'].children:
    if o.get('avatar_hide_back'): o['avatar_hide_back']=['terminal-pack','rocket-pack','bookbag','turtle-shell']

# Semantic pivots keep animations and fitting independent of exported mesh names.
def reparent_world(o,parent):
    matrix=o.matrix_world.copy(); o.parent=parent; o.matrix_world=matrix

def pivot(name,parent,loc,children,motion=None,side=None):
    o=group(name); o.parent=parent; o.location=loc
    bpy.context.view_layer.update()
    for child in children: reparent_world(child,o)
    if motion: o['avatar_motion']=motion
    if side is not None: o['avatar_side']=side
    return o
bpy.context.view_layer.update()
for key in HAIRS:
    g=groups[key]
    corners=[o.matrix_world @ Vector(c) for o in g.children_recursive if o.type=='MESH' for c in o.bound_box]
    g['avatar_hair_top']=max([c.z for c in corners],default=2.40)
    g['avatar_hair_width']=max([abs(c.x) for c in corners],default=.355)

arch=next(o for o in groups['headphones'].children if o.name.startswith('Headband'))
pivot('Headphone_arch',groups['headphones'],(0,0,2.02),[arch])['avatar_fit']='headband'
for o in groups['headphones'].children:
    if o.name.startswith('Ear cup'): o['avatar_fit']='earcup'; o['avatar_side']=1 if o.location.x>0 else -1
    if o.name.startswith('Ear cup accent'): o['avatar_motion']='pulse'
groups['crown']['avatar_fit']='perch'
groups['early-bird-hat']['avatar_fit']='perch'
groups['wings']['avatar_fit']='backpack'

for key,motion,loc,prefixes in [
    ('propeller','spin',(0,.02,2.62),('Propeller blades',)),
    ('duck','duck',(0,.01,2.50),('Duck ',)),
    ('early-bird-hat','bird',(0,.02,2.48),('Bird ',)),
    ('graduation','tassel',(.32,-.23,2.46),('Tassel',)),
    ('flame','flame',(0,.02,2.40),('Flame core','Golden flame'))]:
    g=groups[key]; children=[o for o in g.children if o.name.startswith(prefixes)]
    pivot('Motion_'+key,g,loc,children,motion)
for side in [-1,1]:
    children=[o for o in groups['wings'].children if o.location.x*side>0]
    pivot('Wing_'+str(side),groups['wings'],(side*.29,.22,1.55),children,'wing',side)
for o in groups['wizard'].children:
    if o.name.startswith('Wizard star'): o['avatar_motion']='sparkle'

# Articulated shoulder groups include skin, sleeves and suit gloves together.
for parent in [body]+[groups[key] for key in ['tee','hoodie','lab-coat','space-suit','dungarees']]:
    for side in [-1,1]:
        children=[o for o in parent.children if o.name.startswith(('Arm','Forearm','Hand','Thumb','Sleeve','Pressure glove','Glove thumb','Suit wrist','Shoulder armor','Mission patch')) and o.location.x*side>0]
        shoulder=pivot('Shoulder_'+parent.name+'_'+str(side),parent,(side*.284,0,1.56),children,'arm',side)
        forearms=[o for o in shoulder.children if o.name.startswith(('Forearm','Hand','Thumb','Sleeve forearm','Pressure glove','Glove thumb','Suit wrist'))]
        pivot('Elbow_'+parent.name+'_'+str(side),shoulder,(side*.101,0,-.275),forearms,'elbow',side)
head_children=[o for o in bpy.context.scene.objects if o.get('avatar_slot') in ['character','hair','hat','audio'] or o.get('avatar_slot') in ['accessory','audio','jewellery'] and o.get('avatar_id') in ['glasses','headphones','crown','glasses-69','glasses-67','star-glasses','pixel-shades','owl-glasses','lightning','matrix-shades']]
head=pivot('Head_pose',None,(0,0,1.78),head_children,'head')
# Torso pivots allow a real waist bow without tipping the feet or podium.
pivot('Waist_head',None,(0,0,1.05),[head],'torso')
for parent in [body]+[groups[key] for key in ['tee','hoodie','lab-coat','space-suit','dungarees']]:
    top=[o for o in parent.children if o.name.startswith(('Neck','Shoulder','Torso','Hood','Drawstring','Kangaroo','Inner shirt','Lapel','Coat','Suit control','Suit belt','Life support','Oxygen','Pressure collar','Overall','Suspender','Bib'))]
    pivot('Waist_'+parent.name,parent,(0,0,1.05),top,'torso')
for key in ['wings','terminal-pack','rocket-pack','bookbag','turtle-shell','python-snake','owl-pal','duck-pal','robot-pal','cat-pal','bow-tie','language-medal','star-pin','scarf']:
    g=groups[key]; pivot('Waist_'+key,None,(0,0,1.05),[g],'torso')
for o in bpy.context.scene.objects:
    if o.name.startswith('Eye') and o.parent and o.parent.get('avatar_slot')=='character': o['avatar_motion']='blink'

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
profiles={'robot':((.67,.40,.25),(.10,.055,.035)),'sprout':((.31,.17,.105),(.035,.025,.025)),'fox':((.88,.64,.46),(.23,.10,.055)),'cat':((.60,.42,.30),(.06,.065,.075)),'nova':((.78,.51,.36),(.10,.055,.035))}
colors={'sky':(.12,.36,.72),'mint':(.10,.56,.40),'rose':(.74,.22,.40),'amber':(.87,.48,.12),'violet':(.43,.27,.73),'slate':(.25,.34,.45)}
def select(character='robot',outfit='tee',accessory='none',color='sky',hair_style=None,hat='hat-none',back='back-none',companion='companion-none',audio='audio-none',jewellery='jewel-none'):
    hair_style=hair_style or {'robot':'crop','sprout':'curls','fox':'bob','cat':'bun','nova':'crop'}[character]
    for key,g in groups.items():
        shown=key in [hair_style,outfit,accessory,hat,back,companion,audio,jewellery]
        if g.get('avatar_slot')=='hair' and groups.get(hat) and groups[hat].get('avatar_covers_hair'): shown=False
        for o in g.children_recursive: o.hide_render=not shown
    for o in bpy.context.scene.objects:
        if o.get('avatar_hide_back'): o.hide_render=back in o['avatar_hide_back']
        if o.get('avatar_hide_outfits'): o.hide_render=outfit in o['avatar_hide_outfits']
        if o.get('avatar_slot')=='character':
            for child in o.children_recursive: child.hide_render=o.get('avatar_id')!=character
    for m,value in [(skin,profiles[character][0]),(hair,profiles[character][1]),(cloth,colors[color])]:
        m.diffuse_color=(*value,1);m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(*value,1)
for slot,ids in [('character',['robot','sprout','fox','cat','nova']),('outfit',['tee','hoodie','lab-coat','space-suit','dungarees']),('accessory',['none']+ACCESSORIES),('hair',HAIRS),('hat',['hat-none']+HATS),('audio',['studio-headset','cat-headphones','earbuds','retro-headphones','gamer-headset']),('jewellery',['star-pin','scarf']),('back',['terminal-pack','rocket-pack','bookbag','turtle-shell']),('companion',['python-snake','owl-pal','duck-pal','robot-pal','cat-pal']),('color',list(colors))]:
    for item in ids:
        closeup=slot in ['hair','hat','accessory','companion','audio']
        camera.location=(2.8,-7,2.8) if closeup else (3.1,-6.8,3.05)
        target=Vector((0,0,2.17 if closeup else 1.28));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera.data.ortho_scale=1.6 if closeup else 3.05
        args={'hair_style' if slot=='hair' else slot:item}; select(**args); scene.render.filepath=os.path.join(OUT,slot+'-'+item+'.png')
        if slot=='back':
            camera.location=(3.1,6.8,3.05);camera.rotation_euler=(Vector((0,0,1.28))-camera.location).to_track_quat('-Z','Y').to_euler()
        if '--skip-thumbnails' not in sys.argv and (THUMBNAIL_ONLY is None or item==THUMBNAIL_ONLY): bpy.ops.render.render(write_still=True)
bpy.context.preferences.filepaths.save_version=0
select(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'src/avatar-models/wardrobe.blend'))
print('Saved original Blender wardrobe, GLB and modular thumbnails.')
