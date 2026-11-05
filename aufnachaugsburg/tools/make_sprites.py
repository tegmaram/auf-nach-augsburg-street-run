#!/usr/bin/env python3
"""Draw the pixel-art hero, the Augsburg car and the city crest.

Everything is hand-composed from pixels so the assets stay crisp at the
game's internal resolution. Run from the game folder:

    python tools/make_sprites.py
"""

import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "sprites")
os.makedirs(OUT, exist_ok=True)

BOY_W, BOY_H = 24, 33
CAR_W, CAR_H = 72, 32

INK = (27, 20, 32, 255)
INK_SOFT = (48, 37, 48, 255)
SKIN = (232, 176, 122, 255)
SKIN_LIGHT = (247, 201, 151, 255)
SKIN_DARK = (186, 126, 84, 255)
HAIR = (58, 36, 23, 255)
HAIR_LIGHT = (105, 66, 39, 255)
HOODIE = (48, 118, 184, 255)
HOODIE_LIGHT = (79, 154, 214, 255)
HOODIE_DARK = (30, 75, 122, 255)
HOOD_INNER = (23, 51, 82, 255)
CREAM = (245, 233, 202, 255)
PANTS = (38, 52, 71, 255)
PANTS_LIGHT = (60, 79, 102, 255)
SHOE = (241, 230, 207, 255)
RED = (182, 59, 47, 255)
RED_LIGHT = (224, 92, 67, 255)
GOLD = (217, 164, 65, 255)
GOLD_DARK = (166, 116, 36, 255)
SCARF = (176, 58, 48, 255)
SCARF_LIGHT = (232, 174, 92, 255)

CAR_BODY = (216, 163, 60, 255)
CAR_LIGHT = (246, 199, 98, 255)
CAR_DARK = (164, 111, 28, 255)
CAR_DEEP = (108, 69, 16, 255)
GLASS = (103, 181, 216, 255)
GLASS_LIGHT = (177, 226, 238, 255)
GLASS_DARK = (53, 112, 148, 255)
TIRE = (32, 31, 38, 255)
TIRE_LIGHT = (77, 78, 88, 255)
HUB = (176, 178, 186, 255)
CHROME = (218, 220, 201, 255)
LIGHT = (255, 239, 159, 255)
TAIL = (216, 72, 54, 255)


def canvas(w, h):
    image = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    return image, ImageDraw.Draw(image)


def px(draw, x, y, color):
    draw.point((int(x), int(y)), fill=color)


def rect(draw, x0, y0, x1, y1, color):
    draw.rectangle([int(x0), int(y0), int(x1), int(y1)], fill=color)


def limb(draw, start, end, color, width=2, outline=True):
    if outline:
        draw.line([start, end], fill=INK, width=width + 2)
    draw.line([start, end], fill=color, width=width)
    # square off the ends so the limbs keep a chunky pixel look
    for x, y in (start, end):
        r = width + (2 if outline else 0) // 2
        draw.rectangle([x - 1, y - 1, x + 1, y + 1], fill=INK if outline else color)


def shoe(draw, x, y, forward=True):
    """Small trainer, pointing to the right when forward."""
    rect(draw, x - 1, y - 1, x + 4, y + 2, INK)
    if forward:
        rect(draw, x, y, x + 3, y + 1, SHOE)
        rect(draw, x + 2, y, x + 4, y, SKIN_LIGHT)
        rect(draw, x, y + 2, x + 4, y + 2, RED)
        px(draw, x + 1, y + 1, CREAM)
        rect(draw, x - 1, y + 3, x + 4, y + 3, INK_SOFT)
    else:
        rect(draw, x - 2, y, x + 2, y + 1, SHOE)
        rect(draw, x - 2, y + 2, x + 3, y + 2, RED)
        px(draw, x, y + 1, CREAM)
        rect(draw, x - 2, y + 3, x + 3, y + 3, INK_SOFT)


def draw_head(draw, bob=0, tilt=0):
    top = 1 + bob
    # hood bunched behind the neck
    rect(draw, 5, 10 + bob, 18, 14 + bob, INK)
    rect(draw, 5, 10 + bob, 18, 13 + bob, HOODIE_DARK)
    rect(draw, 7, 10 + bob, 16, 12 + bob, HOOD_INNER)

    # hair silhouette
    rect(draw, 6 + tilt, top, 17 + tilt, top + 4, INK)
    rect(draw, 6 + tilt, top, 16 + tilt, top + 3, HAIR)
    rect(draw, 8 + tilt, top, 13 + tilt, top + 1, HAIR_LIGHT)
    rect(draw, 16 + tilt, top + 1, 17 + tilt, top + 5, HAIR)
    # face
    rect(draw, 7 + tilt, top + 3, 18 + tilt, top + 9, INK)
    rect(draw, 8 + tilt, top + 3, 17 + tilt, top + 9, SKIN)
    rect(draw, 8 + tilt, top + 3, 15 + tilt, top + 4, SKIN_LIGHT)
    # fringe over the forehead
    rect(draw, 7 + tilt, top + 3, 15 + tilt, top + 4, HAIR)
    px(draw, 14 + tilt, top + 4, HAIR)
    px(draw, 15 + tilt, top + 5, HAIR)
    # ear, eye, brow, nose and a tiny grin
    px(draw, 7 + tilt, top + 6, SKIN_DARK)
    rect(draw, 14 + tilt, top + 5, 15 + tilt, top + 6, INK)
    px(draw, 14 + tilt, top + 5, (255, 255, 255, 255))
    px(draw, 13 + tilt, top + 4, HAIR)
    px(draw, 17 + tilt, top + 6, SKIN_DARK)
    px(draw, 16 + tilt, top + 8, SKIN_DARK)
    px(draw, 14 + tilt, top + 8, RED)
    # cheek highlight
    px(draw, 12 + tilt, top + 7, (240, 161, 132, 255))


def draw_torso(draw, bob=0, lean=1):
    top = 11 + bob
    # backpack peeking out on the left
    rect(draw, 3 + lean, top + 1, 7 + lean, top + 9, INK)
    rect(draw, 4 + lean, top + 2, 6 + lean, top + 8, GOLD_DARK)
    rect(draw, 4 + lean, top + 2, 6 + lean, top + 5, GOLD)
    px(draw, 5 + lean, top + 6, GOLD_DARK)

    # hoodie body
    rect(draw, 6 + lean, top, 18 + lean, top + 10, INK)
    rect(draw, 7 + lean, top, 17 + lean, top + 9, HOODIE)
    rect(draw, 8 + lean, top, 13 + lean, top + 2, HOODIE_LIGHT)
    rect(draw, 16 + lean, top + 1, 17 + lean, top + 8, HOODIE_DARK)
    # sleeves / shoulders
    rect(draw, 6 + lean, top + 1, 8 + lean, top + 5, HOODIE_DARK)
    # hood collar and a tucked-in scarf
    rect(draw, 7 + lean, top, 16 + lean, top + 2, INK)
    rect(draw, 8 + lean, top, 15 + lean, top + 1, HOOD_INNER)
    rect(draw, 8 + lean, top + 1, 14 + lean, top + 1, SCARF)
    px(draw, 10 + lean, top + 1, SCARF_LIGHT)
    px(draw, 13 + lean, top + 1, SCARF_LIGHT)
    # cream drawstrings
    rect(draw, 10 + lean, top + 2, 10 + lean, top + 5, CREAM)
    rect(draw, 13 + lean, top + 2, 13 + lean, top + 5, CREAM)
    px(draw, 10 + lean, top + 5, GOLD)
    px(draw, 13 + lean, top + 5, GOLD)
    # rucksack straps, kangaroo pocket and little Augsburg crest
    draw.line([(9 + lean, top + 1), (11 + lean, top + 8)], fill=GOLD_DARK)
    draw.line([(14 + lean, top + 1), (12 + lean, top + 8)], fill=GOLD_DARK)
    draw.line([(9 + lean, top + 6), (15 + lean, top + 6)], fill=HOODIE_DARK)
    rect(draw, 9 + lean, top + 7, 15 + lean, top + 8, HOODIE_DARK)
    rect(draw, 14 + lean, top + 3, 15 + lean, top + 4, RED)
    px(draw, 14 + lean, top + 4, CREAM)
    px(draw, 15 + lean, top + 3, CREAM)


def draw_arm(draw, shoulder, hand, sleeve_color=HOODIE, hand_visible=True):
    limb(draw, shoulder, hand, sleeve_color, width=2)
    # Cuff and a slightly larger, outline-friendly hand.
    rect(draw, hand[0] - 2, hand[1] - 2, hand[0] + 1, hand[1] - 1, HOODIE_DARK)
    if hand_visible:
        rect(draw, hand[0] - 1, hand[1] - 1, hand[0] + 1, hand[1] + 1, INK)
        rect(draw, hand[0] - 1, hand[1] - 1, hand[0], hand[1], SKIN)
        px(draw, hand[0] + 1, hand[1] + 1, SKIN_DARK)


def draw_legs(draw, pose, bob=0):
    hip_l = (10, 21 + bob)
    hip_r = (14, 21 + bob)
    if pose == "stand":
        limb(draw, hip_l, (9, 27 + bob), PANTS)
        limb(draw, hip_r, (15, 27 + bob), PANTS)
        shoe(draw, 7, 29 + bob, False)
        shoe(draw, 14, 29 + bob, True)
    elif pose == "run_a":
        limb(draw, hip_l, (7, 25 + bob), PANTS)
        limb(draw, (7, 25 + bob), (5, 28 + bob), PANTS)
        limb(draw, hip_r, (17, 24 + bob), PANTS)
        limb(draw, (17, 24 + bob), (19, 27 + bob), PANTS)
        shoe(draw, 3, 28 + bob, False)
        shoe(draw, 18, 28 + bob, True)
    elif pose == "run_b":
        limb(draw, hip_l, (11, 26 + bob), PANTS)
        limb(draw, (11, 26 + bob), (9, 29 + bob), PANTS)
        limb(draw, hip_r, (15, 26 + bob), PANTS)
        limb(draw, (15, 26 + bob), (17, 29 + bob), PANTS)
        shoe(draw, 7, 30 + bob, False)
        shoe(draw, 16, 30 + bob, True)
    elif pose == "run_c":
        limb(draw, hip_l, (16, 24 + bob), PANTS)
        limb(draw, (16, 24 + bob), (18, 27 + bob), PANTS)
        limb(draw, hip_r, (8, 25 + bob), PANTS)
        limb(draw, (8, 25 + bob), (5, 28 + bob), PANTS)
        shoe(draw, 17, 28 + bob, True)
        shoe(draw, 3, 28 + bob, False)
    elif pose == "run_d":
        limb(draw, hip_l, (13, 26 + bob), PANTS)
        limb(draw, (13, 26 + bob), (11, 29 + bob), PANTS)
        limb(draw, hip_r, (15, 26 + bob), PANTS)
        limb(draw, (15, 26 + bob), (14, 29 + bob), PANTS)
        shoe(draw, 9, 30 + bob, False)
        shoe(draw, 14, 30 + bob, True)
    elif pose == "run_e":
        limb(draw, hip_l, (8, 26 + bob), PANTS)
        limb(draw, (8, 26 + bob), (6, 29 + bob), PANTS)
        limb(draw, hip_r, (16, 25 + bob), PANTS)
        limb(draw, (16, 25 + bob), (19, 28 + bob), PANTS)
        shoe(draw, 4, 29 + bob, False)
        shoe(draw, 18, 28 + bob, True)
    elif pose == "run_f":
        limb(draw, hip_l, (13, 25 + bob), PANTS)
        limb(draw, (13, 25 + bob), (15, 28 + bob), PANTS)
        limb(draw, hip_r, (9, 26 + bob), PANTS)
        limb(draw, (9, 26 + bob), (6, 29 + bob), PANTS)
        shoe(draw, 14, 28 + bob, True)
        shoe(draw, 4, 29 + bob, False)
    elif pose == "jump":
        limb(draw, hip_l, (8, 24 + bob), PANTS)
        limb(draw, (8, 24 + bob), (6, 26 + bob), PANTS)
        limb(draw, hip_r, (16, 23 + bob), PANTS)
        limb(draw, (16, 23 + bob), (18, 25 + bob), PANTS)
        shoe(draw, 4, 26 + bob, False)
        shoe(draw, 17, 25 + bob, True)
    elif pose == "fall":
        limb(draw, hip_l, (7, 27 + bob), PANTS)
        limb(draw, (7, 27 + bob), (5, 29 + bob), PANTS)
        limb(draw, hip_r, (16, 27 + bob), PANTS)
        limb(draw, (16, 27 + bob), (19, 28 + bob), PANTS)
        shoe(draw, 3, 29 + bob, False)
        shoe(draw, 18, 28 + bob, True)
    elif pose == "cheer":
        limb(draw, hip_l, (9, 26 + bob), PANTS)
        limb(draw, (9, 26 + bob), (8, 28 + bob), PANTS)
        limb(draw, hip_r, (15, 24 + bob), PANTS)
        limb(draw, (15, 24 + bob), (18, 23 + bob), PANTS)
        shoe(draw, 6, 29 + bob, False)
        shoe(draw, 17, 23 + bob, True)


def boy_frame(pose, bob=0, arm_pose="down", wave=False):
    image, draw = canvas(BOY_W, BOY_H)

    if pose == "stand":
        draw_legs(draw, "stand", bob)
    else:
        draw_legs(draw, pose, bob)

    # A short scarf tail catches the run cycle.
    if arm_pose in ("run_a", "run_b", "run_c", "run_d", "run_e", "run_f"):
        rect(draw, 4, 12 + bob, 8, 12 + bob, SCARF)
        rect(draw, 2, 13 + bob, 3, 13 + bob, SCARF_LIGHT)

    # Rear arm first, then body, then front arm.
    if arm_pose == "down":
        draw_arm(draw, (8, 13 + bob), (6, 20 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (19, 19 + bob))
    elif arm_pose == "run_a":
        draw_arm(draw, (8, 13 + bob), (4, 17 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (20, 16 + bob))
    elif arm_pose == "run_b":
        draw_arm(draw, (8, 13 + bob), (6, 18 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (19, 18 + bob))
    elif arm_pose == "run_c":
        draw_arm(draw, (8, 13 + bob), (5, 16 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (20, 18 + bob))
    elif arm_pose == "run_d":
        draw_arm(draw, (8, 13 + bob), (7, 18 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (18, 17 + bob))
    elif arm_pose == "run_e":
        draw_arm(draw, (8, 13 + bob), (5, 18 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (21, 16 + bob))
    elif arm_pose == "run_f":
        draw_arm(draw, (8, 13 + bob), (6, 17 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (19, 19 + bob))
    elif arm_pose == "up":
        draw_arm(draw, (8, 13 + bob), (5, 9 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (19, 8 + bob))
    elif arm_pose == "flail":
        draw_arm(draw, (8, 13 + bob), (3, 12 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (21, 13 + bob))
    elif arm_pose == "cheer":
        draw_arm(draw, (8, 13 + bob), (5, 8 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (20, 7 + bob))
    elif arm_pose == "wave":
        draw_arm(draw, (8, 13 + bob), (6, 19 + bob))
        draw_torso(draw, bob)
        draw_arm(draw, (16, 13 + bob), (21, 10 + bob))
        # waving hand pixels
        px(draw, 22, 9 + bob, SKIN_LIGHT)
        px(draw, 21, 8 + bob, SKIN_LIGHT)

    draw_head(draw, bob)
    return image


def make_boy_sheet():
    poses = [
        ("stand", 0, "down", False),   # 0 idle
        ("stand", 1, "down", False),   # 1 idle breathing
        ("run_a", 0, "run_a", False),  # 2 run contact
        ("run_e", 0, "run_e", False),  # 3 run push-off
        ("run_b", 0, "run_b", False),  # 4 run passing
        ("run_c", 0, "run_c", False),  # 5 opposite contact
        ("run_f", 0, "run_f", False),  # 6 opposite push-off
        ("run_d", 0, "run_d", False),  # 7 opposite passing
        ("jump", 0, "up", False),      # 8
        ("fall", 0, "flail", False),   # 9
        ("cheer", 0, "cheer", False),  # 10
        ("stand", 0, "wave", True),    # 11
    ]
    sheet = Image.new("RGBA", (BOY_W * len(poses), BOY_H), (0, 0, 0, 0))
    for index, (pose, bob, arm, wave) in enumerate(poses):
        sheet.alpha_composite(boy_frame(pose, bob, arm, wave), (index * BOY_W, 0))
    sheet.save(os.path.join(OUT, "boy.png"), optimize=True)

    # preview at 4x for humans
    preview = Image.new("RGBA", (sheet.width * 4, sheet.height * 4), (24, 36, 52, 255))
    for y in range(sheet.height * 4):
        for x in range(sheet.width * 4):
            if (x // 16 + y // 16) % 2 == 0:
                preview.putpixel((x, y), (32, 47, 66, 255))
    preview.alpha_composite(sheet.resize((sheet.width * 4, sheet.height * 4), Image.NEAREST))
    preview.save(os.path.join(ROOT, "tools", "preview-boy.png"))
    print("wrote sprites/boy.png")


def car_frame(spoke_offset=0):
    image, draw = canvas(CAR_W, CAR_H)

    # shadow
    rect(draw, 10, 29, 64, 30, (33, 28, 37, 90))

    # roof rack and luggage
    rect(draw, 22, 5, 48, 6, INK)
    rect(draw, 25, 2, 37, 5, INK)
    rect(draw, 26, 2, 36, 4, (142, 45, 43, 255))
    rect(draw, 28, 1, 34, 1, (176, 67, 58, 255))
    rect(draw, 29, 3, 35, 3, (93, 28, 32, 255))
    px(draw, 27, 2, GOLD)
    # small travel sticker on the suitcase
    px(draw, 30, 2, CREAM)
    px(draw, 31, 2, CREAM)

    # car body outline
    body_outline = [
        (3, 18), (3, 15), (10, 14), (17, 13), (19, 9), (22, 6),
        (28, 5), (46, 5), (52, 8), (56, 13), (66, 14), (69, 16),
        (70, 20), (70, 25), (67, 27), (8, 27), (4, 25),
    ]
    draw.polygon(body_outline, fill=INK)

    # body colour with stepped highlights
    body = [
        (5, 17), (5, 15), (11, 14), (18, 13), (21, 10), (24, 7),
        (28, 6), (46, 6), (51, 9), (55, 13), (66, 14), (68, 17),
        (68, 23), (66, 25), (9, 25), (5, 23),
    ]
    draw.polygon(body, fill=CAR_BODY)
    rect(draw, 7, 15, 65, 16, CAR_LIGHT)
    rect(draw, 59, 16, 67, 20, CAR_LIGHT)
    rect(draw, 6, 21, 66, 24, CAR_DARK)
    rect(draw, 8, 25, 64, 25, CAR_DEEP)

    # windows
    rect(draw, 23, 8, 29, 12, INK)
    rect(draw, 24, 8, 28, 11, GLASS)
    rect(draw, 24, 8, 27, 9, GLASS_LIGHT)
    rect(draw, 31, 8, 33, 12, INK)
    rect(draw, 34, 8, 35, 12, INK)
    rect(draw, 35, 8, 46, 12, INK)
    rect(draw, 36, 8, 45, 11, GLASS)
    rect(draw, 37, 8, 43, 9, GLASS_LIGHT)
    rect(draw, 44, 10, 45, 11, GLASS_DARK)
    rect(draw, 49, 10, 54, 13, INK)
    rect(draw, 50, 10, 53, 12, GLASS)
    px(draw, 51, 10, GLASS_LIGHT)

    # door seam, handle, mirror
    draw.line([(34, 13), (34, 24)], fill=CAR_DEEP)
    rect(draw, 37, 17, 40, 18, CHROME)
    rect(draw, 48, 13, 51, 14, INK)
    rect(draw, 48, 13, 50, 13, CHROME)

    # bumpers, lights, plate
    rect(draw, 62, 17, 69, 20, INK)
    rect(draw, 64, 17, 69, 19, LIGHT)
    px(draw, 69, 17, (255, 252, 208, 255))
    rect(draw, 67, 21, 69, 23, (248, 220, 149, 255))
    rect(draw, 3, 18, 5, 20, INK)
    rect(draw, 3, 18, 4, 19, TAIL)
    rect(draw, 10, 20, 19, 23, INK)
    rect(draw, 11, 21, 18, 22, CREAM)
    rect(draw, 12, 21, 13, 21, INK_SOFT)
    rect(draw, 15, 21, 16, 21, INK_SOFT)
    px(draw, 14, 21, RED)

    # Augsburg pennant on a little antenna at the rear
    rect(draw, 8, 8, 8, 15, INK)
    rect(draw, 5, 8, 8, 10, INK)
    rect(draw, 5, 8, 7, 8, (63, 127, 193, 255))
    rect(draw, 5, 9, 7, 9, CREAM)
    rect(draw, 5, 10, 7, 10, (63, 127, 193, 255))

    # wheels + rims (two animation frames)
    for cx in (17, 55):
        rect(draw, cx - 7, 22, cx + 7, 29, INK)
        draw.ellipse([cx - 6, 22, cx + 6, 30], fill=TIRE)
        draw.ellipse([cx - 4, 23, cx + 4, 29], fill=TIRE_LIGHT)
        draw.ellipse([cx - 3, 24, cx + 3, 28], fill=HUB)
        rect(draw, cx, 23, cx, 29, TIRE_LIGHT)
        if spoke_offset == 0:
            rect(draw, cx - 3, 26, cx + 3, 26, TIRE)
            rect(draw, cx, 24, cx, 28, TIRE)
            px(draw, cx - 1, 25, CREAM)
            px(draw, cx + 1, 27, CREAM)
        else:
            draw.line([(cx - 2, 25), (cx + 2, 28)], fill=TIRE, width=1)
            draw.line([(cx + 2, 25), (cx - 2, 28)], fill=TIRE, width=1)
            px(draw, cx - 2, 25, CREAM)
            px(draw, cx + 2, 28, CREAM)
        px(draw, cx - 3, 27, HUB)
        px(draw, cx + 1, 24, (222, 224, 230, 255))

    # subtle body shine
    for x in (8, 9, 55, 56):
        px(draw, x, 17, (255, 226, 145, 255))
    return image


def make_car_sheets():
    for index in range(2):
        frame = car_frame(index)
        frame.save(os.path.join(OUT, "car.png" if index == 0 else "car-b.png"), optimize=True)

    preview = Image.new("RGBA", (CAR_W * 2, CAR_H * 2), (24, 36, 52, 255))
    for y in range(CAR_H * 2):
        for x in range(CAR_W * 2):
            if (x // 16 + y // 16) % 2 == 0:
                preview.putpixel((x, y), (32, 47, 66, 255))
    preview.alpha_composite(car_frame(0).resize((CAR_W * 2, CAR_H * 2), Image.NEAREST))
    preview.save(os.path.join(ROOT, "tools", "preview-car.png"))
    print("wrote sprites/car.png")


def make_crest():
    """Downscale the official Augsburg coat of arms to crisp pixel art.

    The source in assets/augsburg-wappen.png is the public-domain municipal
    coat of arms (red/white shield with the green Zirbelnuss). It is resized
    once and reduced to a small palette so it matches the game's pixel grid.
    """
    crest_w, crest_h = 64, 76
    source_path = os.path.join(ROOT, "assets", "augsburg-wappen.png")
    if os.path.exists(source_path):
        source = Image.open(source_path).convert("RGBA")
        image = source.resize((crest_w, crest_h), Image.LANCZOS)
        # Quantise against white so the shield stays bright, then restore the
        # transparent cut-out with a hard pixel edge.
        flat = Image.new("RGBA", image.size, (255, 255, 255, 255))
        flat.alpha_composite(image)
        palette = flat.convert("RGB").quantize(colors=10, method=Image.MEDIANCUT).convert("RGB")
        result = palette.convert("RGBA")
        alpha = image.getchannel("A").point(lambda value: 255 if value >= 96 else 0)
        result.putalpha(alpha)
        result.save(os.path.join(OUT, "crest.png"), optimize=True)
        print("wrote sprites/crest.png (official Augsburg mark, 64x76)")
        return

    # Fallback for a checkout without the source image.
    image, draw = canvas(20, 24)
    draw.polygon([(1, 1), (18, 1), (18, 14), (10, 22), (1, 14)], fill=INK)
    draw.polygon([(2, 2), (17, 2), (17, 13), (10, 20), (2, 13)], fill=CREAM)
    draw.polygon([(3, 3), (9, 3), (3, 12)], fill=RED)
    draw.polygon([(10, 3), (16, 3), (16, 8), (10, 13), (10, 3)], fill=(238, 227, 197, 255))
    rect(draw, 9, 6, 12, 7, (64, 111, 66, 255))
    rect(draw, 8, 8, 13, 14, (64, 111, 66, 255))
    rect(draw, 9, 9, 10, 10, (102, 152, 85, 255))
    rect(draw, 11, 11, 12, 12, (102, 152, 85, 255))
    px(draw, 10, 15, (45, 79, 48, 255))
    rect(draw, 8, 5, 13, 5, (45, 79, 48, 255))
    px(draw, 9, 4, (45, 79, 48, 255))
    px(draw, 12, 4, (45, 79, 48, 255))
    px(draw, 2, 2, GOLD)
    px(draw, 17, 2, GOLD)
    image.save(os.path.join(OUT, "crest.png"), optimize=True)
    print("wrote sprites/crest.png (fallback)")


if __name__ == "__main__":
    make_boy_sheet()
    make_car_sheets()
    make_crest()
