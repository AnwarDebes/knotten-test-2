"""Render the Knotten stills + the fly-in animation from the saved master scene."""
import bpy
import math
import os
import time
from pathlib import Path
from mathutils import Vector

KN = Path(r"C:/Users/anwar/Downloads/knotten")
REN = KN / "renders"
ANIM = REN / "anim"
ANIM.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(KN / "blender" / "knotten_master.blend"))
scn = bpy.context.scene
t_start = time.time()

try:
    cp = bpy.context.preferences.addons["cycles"].preferences
    cp.compute_device_type = "OPTIX"
    cp.get_devices_for_type("OPTIX")
    for d in cp.devices:
        d.use = (d.type == "OPTIX")
    scn.cycles.device = "GPU"
    scn.cycles.denoiser = "OPTIX"
    print("GPU:", [d.name for d in cp.devices if d.use])
except Exception as exc:
    print("GPU setup failed:", exc)
scn.cycles.use_adaptive_sampling = True
scn.cycles.adaptive_min_samples = 16

cleared = [o for o in bpy.data.objects if o.name.startswith("Trees_cleared_")]
proposed = [o for o in bpy.data.objects if o.name.startswith(("plot-", "road-"))]
for o in bpy.data.objects:
    if o.name.startswith(("web_", "tree_template_")):
        o.hide_render = True


def set_state(after):
    for o in cleared:
        o.hide_render = after
    for o in proposed:
        o.hide_render = not after


def render(cam, filename, after, w=1920, h=1080, samples=64):
    if (REN / filename).exists():
        print("skip", filename)
        return
    set_state(after)
    scn.camera = bpy.data.objects[cam]
    scn.cycles.samples = samples
    scn.render.resolution_x, scn.render.resolution_y = w, h
    scn.render.image_settings.file_format = "PNG"
    scn.render.filepath = str(REN / filename)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("RENDERED", filename, round(time.time() - t0), "s", flush=True)


render("Cam_Site", "site_after.png", True)
render("Cam_Drone", "drone_before.png", False)
render("Cam_Drone", "drone_after.png", True)
render("Cam_Knoll", "knoll_view_after.png", True)
render("Cam_Grillbu", "grillbu_photo_match.png", False, 1600, 1200)
render("Cam_Farms", "farms_after.png", True)
render("Cam_Plan", "plan_topdown_after.png", True, 2048, 2048)
render("Cam_Plan", "plan_topdown_before.png", False, 2048, 2048)

# ------------------------------------------------------------ fly-in
def ground(x, y):
    dg = bpy.context.evaluated_depsgraph_get()
    hit, loc, *_ = scn.ray_cast(dg, Vector((x, y, 800.0)), Vector((0, 0, -1)))
    return loc.z if hit else 0.0


FRAMES = 72
cam_data = bpy.data.cameras.new("Cam_Fly")
cam_data.lens = 32.0
cam_data.clip_end = 60000.0
cam = bpy.data.objects.new("Cam_Fly", cam_data)
scn.collection.objects.link(cam)
target = bpy.data.objects.new("Fly_Target", None)
scn.collection.objects.link(target)
con = cam.constraints.new("TRACK_TO")
con.target = target
con.track_axis = "TRACK_NEGATIVE_Z"
con.up_axis = "UP_Y"

# over the fjord, sweep in over the farms, settle above the field looking down the sea corridor
path = [
    (1,  (650.0, -1500.0, 520.0), (0.0, -100.0, 40.0)),
    (30, (120.0, -620.0, 300.0), (-20.0, -40.0, 60.0)),
    (55, (-160.0, -260.0, 190.0), (-10.0, 30.0, 70.0)),
    (72, (10.0, 60.0, ground(10.0, 60.0) + 22.0), (40.0, -400.0, 20.0)),
]
for f, loc, tgt in path:
    cam.location = Vector(loc)
    cam.keyframe_insert("location", frame=f)
    target.location = Vector(tgt)
    target.keyframe_insert("location", frame=f)
# Blender 5.x slotted actions: keyframes default to Bezier, nothing to tune here

set_state(True)
scn.camera = cam
scn.frame_start, scn.frame_end = 1, FRAMES
scn.render.fps = 24
scn.cycles.samples = 24
scn.render.resolution_x, scn.render.resolution_y = 1280, 720
scn.render.image_settings.file_format = "PNG"
for f in range(1, FRAMES + 1):
    out = ANIM / ("fly_%04d.png" % f)
    if out.exists():
        continue
    scn.frame_set(f)
    scn.render.filepath = str(out)
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    print("FRAME", f, round(time.time() - t0), "s", flush=True)

# ------------------------------------------------ encode mp4 via the VSE
scn.sequence_editor_create()
se = scn.sequence_editor
strips = getattr(se, "strips", None) or se.sequences
first = ANIM / "fly_0001.png"
strip = strips.new_image("fly", str(first), 1, 1)
for f in range(2, FRAMES + 1):
    strip.elements.append("fly_%04d.png" % f)
scn.render.image_settings.file_format = "FFMPEG"
scn.render.ffmpeg.format = "MPEG4"
scn.render.ffmpeg.codec = "H264"
scn.render.ffmpeg.constant_rate_factor = "HIGH"
scn.render.ffmpeg.ffmpeg_preset = "GOOD"
scn.render.use_sequencer = True
scn.render.filepath = str(REN / "knotten_flyin_720p.mp4")
bpy.ops.render.render(animation=True)
print("ANIM DONE", round(time.time() - t_start), "s", flush=True)
