#!/usr/bin/env python3
"""
Reusable HD-2D Flower Hill asset post-processing and manifest-sync pipeline.

Run via:
  uv run --offline --with pillow --with numpy scripts/process-assets.py \
    --input-dir <raw-assets-dir> \
    --output-dir public/assets \
    --update-manifest src/assets/manifest.ts
"""

from __future__ import annotations

import argparse
from collections import deque
import json
import math
from pathlib import Path
import re
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

# Master composition constants (must match src/scene/layout.ts)
MASTER_CANVAS_WIDTH = 3840
MASTER_CANVAS_HEIGHT = 1600
MASTER_PX_PER_UNIT = 40.0
MASTER_HORIZON_PX_Y = 1040.0
MAX_BACKDROP_WEBP_BYTES = 2_500_000


def load_rgba(path: Path) -> np.ndarray:
    return np.array(Image.open(path).convert('RGBA'), dtype=np.uint8)


def find_raw_file(directory: Path, stem: str) -> Path:
    for ext in ('.png', '.jpg', '.jpeg', '.webp'):
        candidate = directory / f'{stem}{ext}'
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f'Missing raw asset {stem}.{{png,jpg,jpeg,webp}} in {directory}')


def save_rgba(arr: np.ndarray, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr, mode='RGBA').save(path, format='PNG', optimize=True)


def encode_webp(
    arr: np.ndarray,
    out_path: Path,
    quality: int = 86,
    alpha_q: int = 96,
    exact: bool = False,
) -> int:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(suffix='.png', delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        Image.fromarray(arr, mode='RGBA').save(tmp_path, format='PNG')
        cmd = [
            'cwebp',
            '-quiet',
            '-q',
            str(quality),
            '-alpha_q',
            str(alpha_q),
            '-m',
            '6',
        ]
        if exact:
            cmd.append('-exact')
        cmd.extend([str(tmp_path), '-o', str(out_path)])
        subprocess.run(cmd, check=True)
    finally:
        tmp_path.unlink(missing_ok=True)
    return out_path.stat().st_size


def sample_border_bg(rgb: np.ndarray, pad: int = 6) -> np.ndarray:
    h, w, _ = rgb.shape
    pad = min(pad, max(1, h // 10), max(1, w // 10))
    strips = [
        rgb[:pad, :, :].reshape(-1, 3),
        rgb[-pad:, :, :].reshape(-1, 3),
        rgb[:, :pad, :].reshape(-1, 3),
        rgb[:, -pad:, :].reshape(-1, 3),
    ]
    samples = np.concatenate(strips, axis=0)
    return np.median(samples, axis=0).astype(np.float32)


def border_flood_mask(candidate: np.ndarray) -> np.ndarray:
    """Return True for candidate pixels reachable from image edges via 4-neighbors."""
    h, w = candidate.shape
    cand_flat = candidate.ravel().tolist()
    visited = bytearray(h * w)
    q: deque[int] = deque()

    for x in range(w):
        if cand_flat[x] and not visited[x]:
            visited[x] = 1
            q.append(x)
        b = (h - 1) * w + x
        if cand_flat[b] and not visited[b]:
            visited[b] = 1
            q.append(b)
    for y in range(1, h - 1):
        left = y * w
        if cand_flat[left] and not visited[left]:
            visited[left] = 1
            q.append(left)
        right = y * w + (w - 1)
        if cand_flat[right] and not visited[right]:
            visited[right] = 1
            q.append(right)

    while q:
        idx = q.popleft()
        y, x = divmod(idx, w)
        if x > 0:
            n = idx - 1
            if cand_flat[n] and not visited[n]:
                visited[n] = 1
                q.append(n)
        if x + 1 < w:
            n = idx + 1
            if cand_flat[n] and not visited[n]:
                visited[n] = 1
                q.append(n)
        if y > 0:
            n = idx - w
            if cand_flat[n] and not visited[n]:
                visited[n] = 1
                q.append(n)
        if y + 1 < h:
            n = idx + w
            if cand_flat[n] and not visited[n]:
                visited[n] = 1
                q.append(n)

    return np.frombuffer(visited, dtype=np.uint8).reshape((h, w)).astype(bool)


def dilate_mask(mask: np.ndarray, radius: int) -> np.ndarray:
    cur = mask.copy()
    for _ in range(radius):
        p = np.pad(cur, 1, mode='constant', constant_values=False)
        cur = (
            p[1:-1, 1:-1]
            | p[:-2, 1:-1]
            | p[2:, 1:-1]
            | p[1:-1, :-2]
            | p[1:-1, 2:]
            | p[:-2, :-2]
            | p[:-2, 2:]
            | p[2:, :-2]
            | p[2:, 2:]
        )
    return cur


def remove_small_islands(
    rgba: np.ndarray,
    min_pixels: int = 500,
    alpha_thresh: int = 20,
) -> np.ndarray:
    """Zero out disconnected foreground specks smaller than `min_pixels`."""
    out = rgba.copy()
    fg = (out[..., 3] > alpha_thresh).ravel().tolist()
    h, w = out.shape[:2]
    visited = bytearray(h * w)
    keep = bytearray(h * w)

    for start in range(h * w):
        if not fg[start] or visited[start]:
            continue
        comp: list[int] = [start]
        visited[start] = 1
        head = 0
        while head < len(comp):
            idx = comp[head]
            head += 1
            y, x = divmod(idx, w)
            if x > 0:
                n = idx - 1
                if fg[n] and not visited[n]:
                    visited[n] = 1
                    comp.append(n)
            if x + 1 < w:
                n = idx + 1
                if fg[n] and not visited[n]:
                    visited[n] = 1
                    comp.append(n)
            if y > 0:
                n = idx - w
                if fg[n] and not visited[n]:
                    visited[n] = 1
                    comp.append(n)
            if y + 1 < h:
                n = idx + w
                if fg[n] and not visited[n]:
                    visited[n] = 1
                    comp.append(n)
        if len(comp) >= min_pixels:
            for idx in comp:
                keep[idx] = 1

    keep_mask = np.frombuffer(keep, dtype=np.uint8).reshape((h, w)).astype(bool)
    out[~keep_mask, 3] = 0
    return out


def extract_bg_matte(
    rgba: np.ndarray,
    lo_dist: float,
    hi_dist: float,
    border_flood: bool = True,
    clear_interior_dist: float = 0.0,
    bg_rgb: np.ndarray | None = None,
    decontaminate: bool = True,
) -> np.ndarray:
    """
    Remove a solid backdrop color cleanly, producing smooth edge alpha and
    un-premultiplying boundary RGB to eliminate light/dark matte halos.
    """
    rgb = rgba[..., :3].astype(np.float32)
    orig_alpha = rgba[..., 3].astype(np.float32) / 255.0
    if bg_rgb is None:
        bg_rgb = sample_border_bg(rgb)

    diff = rgb - bg_rgb[None, None, :]
    dist = np.linalg.norm(diff, axis=-1)

    if border_flood:
        outer = border_flood_mask(dist <= hi_dist)
        transition_zone = dilate_mask(outer, 3)
        raw_alpha = np.clip((dist - lo_dist) / max(1e-3, hi_dist - lo_dist), 0.0, 1.0)
        alpha = np.where(transition_zone, raw_alpha, 1.0)
        alpha = np.where(outer & (dist <= lo_dist), 0.0, alpha)

        if clear_interior_dist > 0.0:
            hole_lo = clear_interior_dist * 0.55
            hole_alpha = np.clip(
                (dist - hole_lo) / max(1e-3, clear_interior_dist - hole_lo),
                0.0,
                1.0,
            )
            alpha = np.minimum(alpha, hole_alpha)
    else:
        alpha = np.clip((dist - lo_dist) / max(1e-3, hi_dist - lo_dist), 0.0, 1.0)

    alpha = np.minimum(alpha, orig_alpha)

    out_rgb = rgb.copy()
    if decontaminate:
        fringe = (alpha > 0.03) & (alpha < 0.98)
        if np.any(fringe):
            safe_a = np.maximum(alpha[fringe], 0.22)[:, None]
            recovered = (rgb[fringe] - (1.0 - alpha[fringe, None]) * bg_rgb[None, :]) / safe_a
            out_rgb[fringe] = np.clip(recovered, 0.0, 255.0)

    out = np.empty_like(rgba)
    out[..., :3] = np.clip(np.round(out_rgb), 0, 255).astype(np.uint8)
    out[..., 3] = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)
    return out


def bleed_rgb_into_transparent(
    rgba: np.ndarray,
    passes: int = 16,
    alpha_thresh: int = 16,
) -> np.ndarray:
    """Propagate edge RGB outward into transparent pixels without altering alpha."""
    out = rgba.copy()
    rgb = out[..., :3].astype(np.float32)
    filled = out[..., 3] >= alpha_thresh
    if not np.any(filled) or np.all(filled):
        return out

    h, w = filled.shape
    offsets = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]
    for _ in range(passes):
        target = ~filled
        if not np.any(target):
            break
        sum_rgb = np.zeros((h, w, 3), dtype=np.float32)
        cnt = np.zeros((h, w), dtype=np.float32)
        pad_rgb = np.pad(rgb, ((1, 1), (1, 1), (0, 0)), mode='edge')
        pad_ok = np.pad(filled, ((1, 1), (1, 1)), mode='constant', constant_values=False)
        for dy, dx in offsets:
            y0, y1 = 1 + dy, 1 + dy + h
            x0, x1 = 1 + dx, 1 + dx + w
            ok = pad_ok[y0:y1, x0:x1]
            sum_rgb += pad_rgb[y0:y1, x0:x1] * ok[..., None]
            cnt += ok.astype(np.float32)
        upd = target & (cnt > 0)
        if not np.any(upd):
            break
        rgb[upd] = sum_rgb[upd] / cnt[upd, None]
        filled[upd] = True

    out[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    return out


def alpha_bbox(arr: np.ndarray, thresh: int = 4) -> tuple[int, int, int, int]:
    ys, xs = np.where(arr[..., 3] > thresh)
    if len(xs) == 0:
        raise ValueError('Image has no opaque pixels above alpha threshold.')
    return int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1


def fit_and_anchor_bottom_center(
    arr: np.ndarray,
    canvas_w: int,
    canvas_h: int,
    max_w: int,
    max_h: int,
    bottom_margin: int = 2,
) -> np.ndarray:
    x0, y0, x1, y1 = alpha_bbox(arr, thresh=6)
    cropped = arr[y0:y1, x0:x1]
    ch, cw = cropped.shape[:2]
    scale = min(max_w / cw, max_h / ch)
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))

    resized = np.array(
        Image.fromarray(cropped, mode='RGBA').resize((new_w, new_h), Image.Resampling.LANCZOS),
        dtype=np.uint8,
    )
    canvas = np.zeros((canvas_h, canvas_w, 4), dtype=np.uint8)
    dx = (canvas_w - new_w) // 2
    dy = canvas_h - bottom_margin - new_h
    canvas[dy : dy + new_h, dx : dx + new_w] = resized
    return canvas


def process_hero(hero_dir: Path, out_path: Path, debug_out_path: Path | None = None) -> None:
    extracted_v2 = hero_dir / 'extracted-v2'
    extracted = extracted_v2 if (extracted_v2 / 'metadata.json').exists() else (hero_dir / 'extracted')
    meta_path = extracted / 'metadata.json'

    idle_paths: list[Path] = []
    walk_paths: list[Path] = []
    if meta_path.exists():
        meta = json.loads(meta_path.read_text(encoding='utf-8'))
        anims = meta['states'][0]['frames']['animations']
        idle_key = (
            'serene_eyes_closed_idle'
            if 'serene_eyes_closed_idle' in anims
            else next((k for k in anims if 'idle' in k), None)
        )
        walk_key = next((k for k in anims if 'walk' in k), None)
        if idle_key and 'west' in anims[idle_key]:
            raw_idle = [extracted / rel for rel in anims[idle_key]['west']]
            idle_paths = (
                [raw_idle[1], raw_idle[2], raw_idle[3], raw_idle[2]]
                if idle_key == 'serene_eyes_closed_idle' and len(raw_idle) == 4
                else raw_idle
            )
        if walk_key and 'west' in anims[walk_key]:
            walk_paths = [extracted / rel for rel in anims[walk_key]['west']]

    if len(idle_paths) != 4 or len(walk_paths) != 6:
        raise FileNotFoundError(
            f'Expected 4 west idle and 6 west walk frames under {extracted}, '
            f'got idle={len(idle_paths)}, walk={len(walk_paths)}'
        )

    def load_binary_frame(p: Path) -> np.ndarray:
        arr = load_rgba(p)
        binary_a = np.where(arr[..., 3] >= 128, 255, 0).astype(np.uint8)
        arr[..., 3] = binary_a
        arr[binary_a == 0, :3] = 0
        return arr

    def shift_frame_int(frame: np.ndarray, dx: int, dy: int) -> np.ndarray:
        h, w = frame.shape[:2]
        shifted = np.zeros_like(frame)
        src_x0 = max(0, -dx)
        src_x1 = min(w, w - dx)
        src_y0 = max(0, -dy)
        src_y1 = min(h, h - dy)
        dst_x0 = max(0, dx)
        dst_y0 = max(0, dy)
        shifted[dst_y0 : dst_y0 + (src_y1 - src_y0), dst_x0 : dst_x0 + (src_x1 - src_x0)] = frame[
            src_y0:src_y1, src_x0:src_x1
        ]
        return shifted

    def compose_wind_idle(base_frame: np.ndarray, wind_frame: np.ndarray) -> np.ndarray:
        out = base_frame.copy()
        h, w = out.shape[:2]
        ys, xs = np.mgrid[0:h, 0:w]
        # Lock head/crown/face/eyes/torso/hands/boots to base; animate only trailing hair & back hem
        wind_mask = ((xs >= 48) & (ys >= 22) & (ys <= 58)) | ((xs >= 46) & (ys >= 50) & (ys <= 62))
        out[wind_mask] = wind_frame[wind_mask]
        return out

    if idle_key == 'serene_eyes_closed_idle' and len(raw_idle) == 4:
        base_f1 = load_binary_frame(raw_idle[1])
        aligned_f2 = shift_frame_int(load_binary_frame(raw_idle[2]), dx=1, dy=-1)
        aligned_f3 = shift_frame_int(load_binary_frame(raw_idle[3]), dx=1, dy=-1)
        idle_frames = [
            base_f1,
            compose_wind_idle(base_f1, aligned_f2),
            compose_wind_idle(base_f1, aligned_f3),
            compose_wind_idle(base_f1, aligned_f2),
        ]
        stationary_body_x_limit = 46
    else:
        idle_frames = [load_binary_frame(p) for p in idle_paths]
        stationary_body_x_limit = None
    walk_frames = [load_binary_frame(p) for p in walk_paths]

    # Use idle frame 0 as spatial reference for torso/foot alignment
    ref_x0, ref_y0, ref_x1, ref_y1 = alpha_bbox(idle_frames[0], thresh=127)
    ref_h = ref_y1 - ref_y0
    if ref_h > 60:
        raise ValueError(f'Hero sprite height {ref_h}px exceeds 60px limit inside 64x64 frame.')

    # Anchor boots near left-of-center so trailing hair has room to the right
    ref_foot_ys, ref_foot_xs = np.where(
        idle_frames[0][max(ref_y0, ref_y1 - 6) : ref_y1, :, 3] > 0
    )
    ref_foot_center_x = float(np.mean(ref_foot_xs)) if len(ref_foot_xs) else (ref_x0 + ref_x1) * 0.5
    target_foot_center_x = 27.0
    target_bottom_y = 60  # inclusive lowest opaque row = 59 => footPivotY = 4 (rows 60..63 empty)

    shift_x_base = int(round(target_foot_center_x - ref_foot_center_x))
    shift_y_base = target_bottom_y - ref_y1

    cols = 6
    rows = 2
    frame_size = 64
    gutter = 2
    stride = 68
    sheet = np.zeros((rows * stride, cols * stride, 4), dtype=np.uint8)

    def place_frame(frame: np.ndarray, row: int, col: int, is_idle: bool) -> None:
        fx0, fy0, fx1, fy1 = alpha_bbox(frame, thresh=127)
        dx = shift_x_base
        dy = (target_bottom_y - fy1) if is_idle else shift_y_base

        # Clamp integer offset so nothing clips outside the 64x64 art box
        if fx0 + dx < 1:
            dx = 1 - fx0
        if fx1 + dx > frame_size - 1:
            dx = (frame_size - 1) - fx1
        if fy0 + dy < 0:
            dy = -fy0
        if fy1 + dy > target_bottom_y:
            dy = target_bottom_y - fy1

        cell = np.zeros((frame_size, frame_size, 4), dtype=np.uint8)
        crop = frame[fy0:fy1, fx0:fx1]
        dst_x0 = fx0 + dx
        dst_y0 = fy0 + dy
        cell[dst_y0 : dst_y0 + crop.shape[0], dst_x0 : dst_x0 + crop.shape[1]] = crop

        oy = row * stride + gutter
        ox = col * stride + gutter
        sheet[oy : oy + frame_size, ox : ox + frame_size] = cell

    for col, frame in enumerate(idle_frames):
        place_frame(frame, row=0, col=col, is_idle=True)
    for col, frame in enumerate(walk_frames):
        place_frame(frame, row=1, col=col, is_idle=False)

    # Strict QA checks
    assert sheet.shape == (136, 408, 4), f'Unexpected hero sheet shape {sheet.shape}'
    unique_alphas = set(np.unique(sheet[..., 3]).tolist())
    assert unique_alphas <= {0, 255}, f'Hero alpha must be strictly binary, got {unique_alphas}'

    # Assert all 2px gutters are strictly alpha == 0
    for r in range(rows):
        y_base = r * stride
        assert np.all(sheet[y_base : y_base + gutter, :, 3] == 0), 'Top gutter not empty'
        assert np.all(sheet[y_base + stride - gutter : y_base + stride, :, 3] == 0), 'Bottom gutter not empty'
    for c in range(cols):
        x_base = c * stride
        assert np.all(sheet[:, x_base : x_base + gutter, 3] == 0), 'Left gutter not empty'
        assert np.all(sheet[:, x_base + stride - gutter : x_base + stride, 3] == 0), 'Right gutter not empty'

    # Assert idle frames' lowest opaque foot pixel sits at row 59 inside 64x64 (footPivotY=4)
    idle_boxes: list[np.ndarray] = []
    for col in range(4):
        oy = gutter
        ox = col * stride + gutter
        box = sheet[oy : oy + frame_size, ox : ox + frame_size]
        ys = np.where(box[..., 3] > 0)[0]
        assert int(ys.max()) == 59, f'Idle frame {col} lowest pixel y={ys.max()} != 59'
        idle_boxes.append(box)

    if stationary_body_x_limit is not None:
        cut_cell_x = stationary_body_x_limit + shift_x_base
        for col in range(1, 4):
            assert np.array_equal(
                idle_boxes[col][:, :cut_cell_x],
                idle_boxes[0][:, :cut_cell_x],
            ), f'Idle frame {col} moved inside stationary body region x < {cut_cell_x}!'
        diff_01 = int(np.any(idle_boxes[1] != idle_boxes[0], axis=-1).sum())
        diff_12 = int(np.any(idle_boxes[2] != idle_boxes[1], axis=-1).sum())
        assert diff_01 >= 35 and diff_12 >= 35, (
            f'Idle hair/hem wind motion too subtle: diff_01={diff_01}, diff_12={diff_12}'
        )

    save_rgba(sheet, out_path)
    if debug_out_path is not None:
        debug_4x = Image.fromarray(sheet, mode='RGBA').resize(
            (sheet.shape[1] * 4, sheet.shape[0] * 4),
            Image.Resampling.NEAREST,
        )
        debug_4x.save(debug_out_path, format='PNG')


def process_foliage_atlas(
    raw_path: Path,
    out_path: Path,
    bg_mode: str,
) -> None:
    raw = load_rgba(raw_path)
    h, w = raw.shape[:2]
    half_h, half_w = h // 2, w // 2
    atlas = np.zeros((256, 256, 4), dtype=np.uint8)

    if bg_mode == 'light':
        lo_dist, hi_dist, interior = 18.0, 62.0, 22.0
    elif bg_mode == 'dark':
        lo_dist, hi_dist, interior = 16.0, 56.0, 18.0
    else:
        raise ValueError(f'Unknown bg_mode: {bg_mode}')

    # Sample background from the outer margin of the full sheet
    bg_rgb = sample_border_bg(raw[..., :3].astype(np.float32), pad=8)

    for row in range(2):
        for col in range(2):
            quad = raw[
                row * half_h : (row + 1) * half_h,
                col * half_w : (col + 1) * half_w,
            ]
            # Shave 4px edge margin in case quadrants kiss the center seam
            matted = extract_bg_matte(
                quad,
                lo_dist=lo_dist,
                hi_dist=hi_dist,
                border_flood=True,
                clear_interior_dist=interior,
                bg_rgb=bg_rgb,
                decontaminate=True,
            )
            cell = fit_and_anchor_bottom_center(
                matted,
                canvas_w=128,
                canvas_h=128,
                max_w=118,
                max_h=120,
                bottom_margin=2,
            )
            cell = bleed_rgb_into_transparent(cell, passes=16, alpha_thresh=16)

            # QA checks per cell
            assert np.any(cell[..., 3] > 200), f'Foliage cell ({row},{col}) empty in {out_path.name}'
            assert np.any((cell[..., 3] > 20) & (cell[..., 3] < 235)), (
                f'Foliage cell ({row},{col}) lacks smooth alpha edge ramp'
            )

            cy, cx = row * 128, col * 128
            atlas[cy : cy + 128, cx : cx + 128] = cell

    assert atlas.shape == (256, 256, 4)
    save_rgba(atlas, out_path)


def crop_pixels_to_manifest(crop_x: int, crop_y: int, crop_w: int, crop_h: int) -> dict[str, float]:
    center_x = crop_x + crop_w * 0.5
    center_y = crop_y + crop_h * 0.5
    return {
        'offsetX': round((center_x - MASTER_CANVAS_WIDTH * 0.5) / MASTER_PX_PER_UNIT, 3),
        'offsetY': round((MASTER_HORIZON_PX_Y - center_y) / MASTER_PX_PER_UNIT, 3),
        'worldWidth': round(crop_w / MASTER_PX_PER_UNIT, 3),
        'worldHeight': round(crop_h / MASTER_PX_PER_UNIT, 3),
    }


def apply_edge_fade(
    arr: np.ndarray,
    left_frac: float = 0.0,
    right_frac: float = 0.0,
    top_frac: float = 0.0,
    bottom_frac: float = 0.0,
) -> np.ndarray:
    out = arr.copy()
    h, w = out.shape[:2]
    alpha = out[..., 3].astype(np.float32)

    if left_frac > 0:
        px = max(1, int(round(w * left_frac)))
        ramp = 0.5 - 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, px, dtype=np.float32))
        alpha[:, :px] *= ramp[None, :]
    if right_frac > 0:
        px = max(1, int(round(w * right_frac)))
        ramp = 0.5 - 0.5 * np.cos(np.pi * np.linspace(1.0, 0.0, px, dtype=np.float32))
        alpha[:, -px:] *= ramp[None, :]
    if top_frac > 0:
        px = max(1, int(round(h * top_frac)))
        ramp = 0.5 - 0.5 * np.cos(np.pi * np.linspace(0.0, 1.0, px, dtype=np.float32))
        alpha[:px, :] *= ramp[:, None]
    if bottom_frac > 0:
        px = max(1, int(round(h * bottom_frac)))
        ramp = 0.5 - 0.5 * np.cos(np.pi * np.linspace(1.0, 0.0, px, dtype=np.float32))
        alpha[-px:, :] *= ramp[:, None]

    out[..., 3] = np.clip(np.round(alpha), 0, 255).astype(np.uint8)
    return out


def place_in_master_slot(
    cleaned: np.ndarray,
    slot_x0: int,
    slot_y0: int,
    slot_x1: int,
    slot_y1: int,
    align_x: str = 'center',
    align_y: str = 'bottom',
) -> tuple[np.ndarray, int, int, int, int]:
    x0, y0, x1, y1 = alpha_bbox(cleaned, thresh=8)
    tight = cleaned[y0:y1, x0:x1]
    ch, cw = tight.shape[:2]
    slot_w = slot_x1 - slot_x0
    slot_h = slot_y1 - slot_y0
    scale = min(slot_w / cw, slot_h / ch)
    new_w = max(1, int(round(cw * scale)))
    new_h = max(1, int(round(ch * scale)))
    resized = np.array(
        Image.fromarray(tight, mode='RGBA').resize((new_w, new_h), Image.Resampling.LANCZOS),
        dtype=np.uint8,
    )
    if align_x == 'left':
        px = slot_x0
    elif align_x == 'right':
        px = slot_x1 - new_w
    else:
        px = slot_x0 + (slot_w - new_w) // 2

    if align_y == 'top':
        py = slot_y0
    elif align_y == 'center':
        py = slot_y0 + (slot_h - new_h) // 2
    else:
        py = slot_y1 - new_h

    return resized, px, py, new_w, new_h


def grade_atmospheric_depth(
    rgba: np.ndarray,
    lift_floor: float,
    mist_rgb: tuple[float, float, float],
    mist_bottom: float,
    mist_top: float,
) -> np.ndarray:
    """
    Soften dark pixel outlines into atmospheric slate shadows and apply a
    vertical aerial-perspective mist ramp so backdrop plates recede naturally.
    """
    out = rgba.copy()
    rgb = out[..., :3].astype(np.float32)
    h = out.shape[0]
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    # Lift near-black lineart floor smoothly toward cool slate shadow
    shadow_target = np.array([mist_rgb[0] * 0.42, mist_rgb[1] * 0.44, mist_rgb[2] * 0.48], dtype=np.float32)
    floor_t = np.clip((lift_floor - lum) / max(1.0, lift_floor), 0.0, 1.0)[..., None] * 0.72
    rgb = rgb * (1.0 - floor_t) + shadow_target[None, None, :] * floor_t

    # Vertical atmospheric mist (stronger at valley base, lighter at upper spires)
    y_norm = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    mist_t = mist_top + (mist_bottom - mist_top) * np.power(y_norm, 1.35)
    mist_vec = np.array(mist_rgb, dtype=np.float32)[None, None, :]
    rgb = rgb * (1.0 - mist_t) + mist_vec * mist_t

    out[..., :3] = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    return out


def process_citadel(
    main_raw_path: Path,
    hills_raw_path: Path | None,
    out_path: Path,
    quality: int = 86,
) -> tuple[dict[str, float], int]:
    if main_raw_path.name.startswith('citadel-user-v4-raw'):
        raw = load_rgba(main_raw_path)
        h, w = raw.shape[:2]
        if float((raw[..., 3] < 20).mean()) > 0.10:
            matted = raw.copy()
        else:
            sky_patch = raw[:24, int(w * 0.82) : max(int(w * 0.82) + 1, w - 4), :3]
            bg_rgb = (
                np.median(sky_patch.reshape(-1, 3), axis=0).astype(np.float32)
                if sky_patch.size > 0
                else np.array([255.0, 255.0, 255.0], dtype=np.float32)
            )
            padded = np.full((h + 2, w, 4), (80, 84, 80, 255), dtype=np.uint8)
            padded[:h, :] = raw
            matted_padded = extract_bg_matte(
                padded,
                lo_dist=8.0,
                hi_dist=32.0,
                border_flood=True,
                clear_interior_dist=0.0,
                bg_rgb=bg_rgb,
                decontaminate=True,
            )
            matted = remove_small_islands(matted_padded[:h, :], min_pixels=200, alpha_thresh=16)
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=22.0,
            mist_rgb=(220.0, 222.0, 216.0),
            mist_bottom=0.14,
            mist_top=0.02,
        )
        placed, cx, cy, cw, ch = place_in_master_slot(
            matted,
            slot_x0=360,
            slot_y0=160,
            slot_x1=1860,
            slot_y1=1300,
            align_x='center',
            align_y='bottom',
        )
        placed = np.array(
            Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.35)),
            dtype=np.uint8,
        )
        placed = apply_edge_fade(placed, bottom_frac=0.08)
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
        byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
        placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    if main_raw_path.name.startswith('citadel-valley-v3-raw'):
        raw = load_rgba(main_raw_path)
        h, w = raw.shape[:2]
        bg_rgb = np.median(raw[:24, int(w * 0.80) : w - 4, :3].reshape(-1, 3), axis=0).astype(np.float32)
        padded = np.full((h + 2, w + 2, 4), (60, 64, 60, 255), dtype=np.uint8)
        padded[:h, 2:] = raw
        matted_padded = extract_bg_matte(
            padded,
            lo_dist=12.0,
            hi_dist=36.0,
            border_flood=True,
            clear_interior_dist=0.0,
            bg_rgb=bg_rgb,
            decontaminate=True,
        )
        matted = matted_padded[:h, 2:]
        matted = remove_small_islands(matted, min_pixels=250, alpha_thresh=20)
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=64.0,
            mist_rgb=(214.0, 218.0, 216.0),
            mist_bottom=0.22,
            mist_top=0.05,
        )
        placed, cx, cy, cw, ch = place_in_master_slot(
            matted,
            slot_x0=-160,
            slot_y0=300,
            slot_x1=2160,
            slot_y1=1380,
            align_x='left',
            align_y='bottom',
        )
        placed = np.array(
            Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.4)),
            dtype=np.uint8,
        )
        placed = apply_edge_fade(placed, bottom_frac=0.10)
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
        byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
        placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    if main_raw_path.name.startswith('citadel-valley-v2-raw'):
        raw = load_rgba(main_raw_path)
        # Crop out the thin extra rising rock wall on the far right edge so the green promontory slopes cleanly into valley
        raw = raw[:, :710, :]
        # Sample sky strictly from the pure open top-right sky patch (avoid dark cliffs along bottom/left border)
        bg_rgb = np.median(raw[:24, 560:700, :3].reshape(-1, 3), axis=0).astype(np.float32)
        matted = extract_bg_matte(
            raw,
            lo_dist=12.0,
            hi_dist=36.0,
            border_flood=True,
            clear_interior_dist=0.0,
            bg_rgb=bg_rgb,
            decontaminate=True,
        )
        matted = remove_small_islands(matted, min_pixels=250, alpha_thresh=20)
        # Keep crisp citadel/waterfall/aqueduct contrast with gentle atmospheric lift
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=42.0,
            mist_rgb=(214.0, 218.0, 216.0),
            mist_bottom=0.22,
            mist_top=0.05,
        )
        placed, cx, cy, cw, ch = place_in_master_slot(
            matted,
            slot_x0=-160,
            slot_y0=420,
            slot_x1=2160,
            slot_y1=1380,
            align_x='left',
            align_y='bottom',
        )
        placed = np.array(
            Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.4)),
            dtype=np.uint8,
        )
        placed = apply_edge_fade(placed, right_frac=0.08, bottom_frac=0.10)
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
        byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
        placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    # Legacy fallback path: Front-left silver-white marble citadel
    main_raw = load_rgba(main_raw_path)
    main_matted = extract_bg_matte(
        main_raw,
        lo_dist=14.0,
        hi_dist=44.0,
        border_flood=True,
        clear_interior_dist=0.0,
        decontaminate=True,
    )
    rgb = main_raw[..., :3].astype(np.float32)
    bg_rgb = sample_border_bg(rgb, pad=6)
    dist = np.linalg.norm(rgb - bg_rgb[None, None, :], axis=-1)
    sky_arches = (np.arange(main_raw.shape[0])[:, None] < int(main_raw.shape[0] * 0.72)) & (dist <= 10.0)
    main_matted[sky_arches, 3] = 0
    main_matted = remove_small_islands(main_matted, min_pixels=400, alpha_thresh=20)
    main_matted = grade_atmospheric_depth(
        main_matted,
        lift_floor=68.0,
        mist_rgb=(220.0, 224.0, 226.0),
        mist_bottom=0.38,
        mist_top=0.14,
    )

    main_placed, mx, my, mw, mh = place_in_master_slot(
        main_matted,
        slot_x0=180,
        slot_y0=280,
        slot_x1=1460,
        slot_y1=1480,
        align_x='left',
        align_y='bottom',
    )

    if hills_raw_path is not None and hills_raw_path.exists():
        hills_raw = load_rgba(hills_raw_path)
        hills_matted = extract_bg_matte(
            hills_raw,
            lo_dist=14.0,
            hi_dist=44.0,
            border_flood=True,
            clear_interior_dist=0.0,
            decontaminate=True,
        )
        hills_matted = remove_small_islands(hills_matted, min_pixels=400, alpha_thresh=20)
        hills_matted = grade_atmospheric_depth(
            hills_matted,
            lift_floor=78.0,
            mist_rgb=(218.0, 222.0, 224.0),
            mist_bottom=0.58,
            mist_top=0.34,
        )
        hills_placed, hx, hy, hw, hh = place_in_master_slot(
            hills_matted,
            slot_x0=600,
            slot_y0=680,
            slot_x1=1980,
            slot_y1=1490,
            align_x='right',
            align_y='bottom',
        )
        hills_placed = apply_edge_fade(hills_placed, left_frac=0.12, right_frac=0.14, bottom_frac=0.16)

        comp_x0 = min(mx, hx)
        comp_y0 = min(my, hy)
        comp_x1 = max(mx + mw, hx + hw)
        comp_y1 = max(my + mh, hy + hh)
        comp_w = comp_x1 - comp_x0
        comp_h = comp_y1 - comp_y0
        composite = np.zeros((comp_h, comp_w, 4), dtype=np.uint8)

        # Back valley hills + distant keep
        alpha_composite_over(composite, hills_placed, hx - comp_x0, hy - comp_y0)

        # Subtle wispy pearl mist veil separating valley hills from foreground citadel cliffs
        veil = np.zeros((comp_h, comp_w, 4), dtype=np.uint8)
        y_v = np.linspace(0.0, 1.0, comp_h, dtype=np.float32)[:, None]
        veil_a = np.clip((y_v - 0.35) / 0.65, 0.0, 1.0) * 68.0
        veil[..., 0] = 224
        veil[..., 1] = 227
        veil[..., 2] = 228
        veil[..., 3] = np.round(veil_a).astype(np.uint8)
        alpha_composite_over(composite, veil, 0, 0)

        # Front silver-white marble citadel (feather right edge before over-compositing onto valley hills)
        main_feathered = apply_edge_fade(main_placed, right_frac=0.15)
        alpha_composite_over(composite, main_feathered, mx - comp_x0, my - comp_y0)
        placed, cx, cy = composite, comp_x0, comp_y0
    else:
        placed, cx, cy = main_placed, mx, my

    placed = np.array(
        Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.55)),
        dtype=np.uint8,
    )
    placed = apply_edge_fade(placed, left_frac=0.08, right_frac=0.14, bottom_frac=0.16)
    tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
    trimmed = placed[ty0:ty1, tx0:tx1]
    trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
    byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
    placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
    return placement, byte_size


def process_ghost_castle(raw_path: Path, out_path: Path, quality: int = 86) -> tuple[dict[str, float], int]:
    raw = load_rgba(raw_path)
    if raw_path.name.startswith('far-mountains-v2-raw'):
        # Sample sky strictly from the pure top sky strip (avoid dark bottom mountains)
        bg_rgb = np.median(raw[:16, :, :3].reshape(-1, 3), axis=0).astype(np.float32)
        matted = extract_bg_matte(
            raw,
            lo_dist=12.0,
            hi_dist=36.0,
            border_flood=True,
            clear_interior_dist=0.0,
            bg_rgb=bg_rgb,
            decontaminate=True,
        )
        matted = remove_small_islands(matted, min_pixels=200, alpha_thresh=18)
        # Soften dark mountain foreground ridges gently into realistic distant blue-sage mist
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=115.0,
            mist_rgb=(210.0, 214.0, 215.0),
            mist_bottom=0.52,
            mist_top=0.28,
        )
        # Extend left & right flanks cleanly with fliplr at each edge so ridge heights match continuously without duplicating castle
        flank_l = np.fliplr(matted[:, :200, :])
        flank_r_src = matted[:, -75:, :]
        flank_r = np.concatenate([np.fliplr(flank_r_src), flank_r_src], axis=1)
        panoramic = np.concatenate([flank_l, matted, flank_r], axis=1)
        placed, cx, cy, cw, ch = place_in_master_slot(
            panoramic,
            slot_x0=-480,
            slot_y0=400,
            slot_x1=4680,
            slot_y1=1360,
            align_x='center',
            align_y='bottom',
        )
        placed = np.array(
            Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.5)),
            dtype=np.uint8,
        )
        placed = apply_edge_fade(placed, left_frac=0.03, right_frac=0.03, bottom_frac=0.14)
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=14, alpha_thresh=14)
        byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
        placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    rgb = raw[..., :3].astype(np.float32)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]

    # Map luminance smoothly to luminous misty pearl-grey mirage: sky/dark wisps fade to 0 while spires stay intact
    lum_norm = np.clip((lum - 46.0) / 138.0, 0.0, 1.0)
    alpha = np.power(lum_norm, 0.78) * 0.84

    shadow_mist = np.array([154.0, 162.0, 174.0], dtype=np.float32)[None, None, :]
    light_mist = np.array([228.0, 226.0, 216.0], dtype=np.float32)[None, None, :]
    clean_rgb = shadow_mist * (1.0 - lum_norm[..., None]) + light_mist * lum_norm[..., None]

    matted = np.empty_like(raw)
    matted[..., :3] = np.clip(np.round(clean_rgb), 0, 255).astype(np.uint8)
    matted[..., 3] = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)

    placed, cx, cy, cw, ch = place_in_master_slot(
        matted,
        slot_x0=1960,
        slot_y0=480,
        slot_x1=2760,
        slot_y1=1180,
        align_x='center',
        align_y='bottom',
    )
    placed = np.array(
        Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.9)),
        dtype=np.uint8,
    )
    placed = apply_edge_fade(placed, left_frac=0.18, right_frac=0.18, top_frac=0.12, bottom_frac=0.24)
    tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
    trimmed = placed[ty0:ty1, tx0:tx1]
    trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=12)
    byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
    placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
    return placement, byte_size


def process_watchtower(raw_path: Path, out_path: Path, quality: int = 86) -> tuple[dict[str, float], int]:
    raw = load_rgba(raw_path)
    if raw_path.name.startswith('watchtower-sanctuary-v3-raw'):
        bg_rgb = np.median(raw[:24, :24, :3].reshape(-1, 3), axis=0).astype(np.float32)
        rgb_raw = raw[..., :3].astype(np.float32)
        mag_raw = 0.5 * (rgb_raw[..., 0] + rgb_raw[..., 2]) - rgb_raw[..., 1]
        dist_raw = np.linalg.norm(rgb_raw - bg_rgb[None, None, :], axis=-1)
        outer_mag = border_flood_mask((dist_raw <= 88.0) | (mag_raw > 26.0))
        matted = extract_bg_matte(
            raw,
            lo_dist=26.0,
            hi_dist=84.0,
            border_flood=True,
            clear_interior_dist=0.0,
            bg_rgb=bg_rgb,
            decontaminate=True,
        )
        matted[outer_mag, 3] = 0
        alpha = np.where(matted[..., 3] >= 160, 255, 0).astype(np.uint8)
        # Purge any remaining magenta fringe on outer 3px ring and neutralize spill on 4px ring
        rgb_f = matted[..., :3].astype(np.float32)
        mag_excess = 0.5 * (rgb_f[..., 0] + rgb_f[..., 2]) - rgb_f[..., 1]
        outer_ring = dilate_mask(alpha == 0, 3) & (alpha > 0)
        alpha[outer_ring & (mag_excess > 16.0)] = 0
        near_edge = dilate_mask(alpha == 0, 4) & (alpha > 0)
        despill = near_edge & (mag_excess > 6.0)
        if np.any(despill):
            g_val = rgb_f[despill, 1]
            rgb_f[despill, 0] = np.minimum(rgb_f[despill, 0], g_val + 4.0)
            rgb_f[despill, 2] = np.minimum(rgb_f[despill, 2], g_val + 4.0)
        matted[..., :3] = np.clip(np.round(rgb_f), 0, 255).astype(np.uint8)
        matted[..., 3] = alpha
        matted = remove_small_islands(matted, min_pixels=120, alpha_thresh=128)
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=28.0,
            mist_rgb=(232.0, 229.0, 220.0),
            mist_bottom=0.10,
            mist_top=0.02,
        )
        mh = matted.shape[0]
        # Splice left rubble parapet + overhanging cliff edge cleanly onto the right wall
        base_body = matted[:, :868, :].copy()
        right_cap = np.fliplr(matted[:, 285:466, :])
        seam_w = 22
        ext_w = base_body.shape[1] + right_cap.shape[1] - seam_w
        extended = np.zeros((mh, ext_w, 4), dtype=np.uint8)
        extended[:, : 868 - seam_w, :] = base_body[:, : 868 - seam_w, :]
        extended[:, 868:, :] = right_cap[:, seam_w:, :]

        b_ov = base_body[:, 868 - seam_w : 868, :]
        r_ov = right_cap[:, :seam_w, :]
        both = (b_ov[..., 3] > 128) & (r_ov[..., 3] > 128)
        only_b = (b_ov[..., 3] > 128) & (r_ov[..., 3] <= 128)
        only_r = (r_ov[..., 3] > 128) & (b_ov[..., 3] <= 128)

        t_blend = np.linspace(0.0, 1.0, seam_w, dtype=np.float32)[None, :, None]
        blended_rgb = np.clip(
            np.round(b_ov[..., :3].astype(np.float32) * (1.0 - t_blend) + r_ov[..., :3].astype(np.float32) * t_blend),
            0,
            255,
        ).astype(np.uint8)
        ys_grid = np.arange(mh, dtype=np.int32)[:, None]
        slope_cut = (615.0 + (np.arange(seam_w, dtype=np.float32) / max(1, seam_w - 1)) * 64.0)[None, :]
        keep_b = only_b & (ys_grid >= slope_cut)

        ov_out = np.zeros_like(b_ov)
        ov_out[both, :3] = blended_rgb[both]
        ov_out[both, 3] = 255
        ov_out[keep_b, :3] = b_ov[keep_b, :3]
        ov_out[keep_b, 3] = 255
        ov_out[only_r, :3] = r_ov[only_r, :3]
        ov_out[only_r, 3] = 255
        extended[:, 868 - seam_w : 868, :] = ov_out

        x0, y0, x1, y1 = alpha_bbox(extended, thresh=128)
        tight = extended[y0:y1, x0:x1]
        ch, cw = tight.shape[:2]
        scale = 1040.0 / ch
        new_w = max(1, int(round(cw * scale)))
        new_h = max(1, int(round(ch * scale)))
        placed = np.array(
            Image.fromarray(tight, mode='RGBA').resize((new_w, new_h), Image.Resampling.NEAREST),
            dtype=np.uint8,
        )
        px = 2520
        py = 1320 - new_h
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=128)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=12, alpha_thresh=128)
        byte_size = encode_webp(trimmed, out_path, quality=92, alpha_q=100, exact=True)
        placement = crop_pixels_to_manifest(px + tx0, py + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    if raw_path.name.startswith('watchtower-cliff-v2-raw'):
        # Sample sky strictly from the pure top-left sky strip (avoid dark right cliff)
        bg_rgb = np.median(raw[:24, :280, :3].reshape(-1, 3), axis=0).astype(np.float32)
        matted = extract_bg_matte(
            raw,
            lo_dist=12.0,
            hi_dist=36.0,
            border_flood=True,
            clear_interior_dist=0.0,
            bg_rgb=bg_rgb,
            decontaminate=True,
        )
        matted = remove_small_islands(matted, min_pixels=200, alpha_thresh=18)
        matted = grade_atmospheric_depth(
            matted,
            lift_floor=36.0,
            mist_rgb=(210.0, 214.0, 212.0),
            mist_bottom=0.14,
            mist_top=0.03,
        )
        # Extend cliff rock wall rightward using ONLY the building-free far-right mossy rock strip
        right_cliff = matted[:, -44:, :]
        extended = np.concatenate(
            [matted, np.fliplr(right_cliff), right_cliff, np.fliplr(right_cliff)],
            axis=1,
        )
        placed, cx, cy, cw, ch = place_in_master_slot(
            extended,
            slot_x0=1660,
            slot_y0=390,
            slot_x1=3580,
            slot_y1=1360,
            align_x='left',
            align_y='bottom',
        )
        placed = np.array(
            Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.35)),
            dtype=np.uint8,
        )
        placed = apply_edge_fade(placed, left_frac=0.06, bottom_frac=0.08)
        tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
        trimmed = placed[ty0:ty1, tx0:tx1]
        trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
        byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
        placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
        return placement, byte_size

    rgb = raw[..., :3].astype(np.float32)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    bg_decontam = np.array([205.0, 200.0, 178.0], dtype=np.float32)

    # Warm beige gradient sky has lum >= 175 while stone watchtower/obelisk is <= 155
    outer = border_flood_mask(lum >= 162.0)
    transition = dilate_mask(outer, 3)
    raw_alpha = np.clip((174.0 - lum) / 24.0, 0.0, 1.0)
    alpha = np.where(transition, raw_alpha, 1.0)
    alpha = np.where(outer & (lum >= 174.0), 0.0, alpha)

    out_rgb = rgb.copy()
    fringe = (alpha > 0.03) & (alpha < 0.98)
    if np.any(fringe):
        safe_a = np.maximum(alpha[fringe], 0.22)[:, None]
        out_rgb[fringe] = np.clip(
            (rgb[fringe] - (1.0 - alpha[fringe, None]) * bg_decontam[None, :]) / safe_a,
            0.0,
            255.0,
        )

    matted = np.empty_like(raw)
    matted[..., :3] = np.clip(np.round(out_rgb), 0, 255).astype(np.uint8)
    matted[..., 3] = np.clip(np.round(alpha * 255.0), 0, 255).astype(np.uint8)
    matted = remove_small_islands(matted, min_pixels=300, alpha_thresh=20)
    matted = grade_atmospheric_depth(
        matted,
        lift_floor=72.0,
        mist_rgb=(218.0, 219.0, 213.0),
        mist_bottom=0.38,
        mist_top=0.18,
    )

    placed, cx, cy, cw, ch = place_in_master_slot(
        matted,
        slot_x0=2430,
        slot_y0=330,
        slot_x1=2970,
        slot_y1=1220,
        align_x='center',
        align_y='bottom',
    )
    placed = np.array(
        Image.fromarray(placed, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.55)),
        dtype=np.uint8,
    )
    placed = apply_edge_fade(placed, left_frac=0.08, right_frac=0.04, bottom_frac=0.16)
    tx0, ty0, tx1, ty1 = alpha_bbox(placed, thresh=4)
    trimmed = placed[ty0:ty1, tx0:tx1]
    trimmed = bleed_rgb_into_transparent(trimmed, passes=16, alpha_thresh=16)
    byte_size = encode_webp(trimmed, out_path, quality=quality, alpha_q=95)
    placement = crop_pixels_to_manifest(cx + tx0, cy + ty0, tx1 - tx0, ty1 - ty0)
    return placement, byte_size


def process_cloud_bank_right(raw_path: Path, out_path: Path, quality: int = 86) -> int:
    raw = load_rgba(raw_path)
    h, w = raw.shape[:2]
    bg_rgb = np.median(raw[:16, :120, :3].reshape(-1, 3), axis=0).astype(np.float32)
    # Pad left, right, and bottom 2px opaque so flood keys ONLY sky above cumulus tops (no interior gaps)
    padded = np.full((h + 2, w + 4, 4), (180, 175, 165, 255), dtype=np.uint8)
    padded[:h, 2 : w + 2] = raw
    matted = extract_bg_matte(
        padded,
        lo_dist=18.0,
        hi_dist=42.0,
        border_flood=True,
        clear_interior_dist=0.0,
        bg_rgb=bg_rgb,
        decontaminate=True,
    )[:h, 2 : w + 2]
    matted = remove_small_islands(matted, min_pixels=150, alpha_thresh=24)

    rgb = matted[..., :3].astype(np.float32)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    t = np.clip((lum - 68.0) / 172.0, 0.0, 1.0)
    t_q = np.floor(t * 6.0) / 5.0
    t_mix = np.clip(0.65 * t_q + 0.35 * t, 0.0, 1.0)

    c_shadow = np.array([207.0, 201.0, 188.0], dtype=np.float32)
    c_mid = np.array([220.0, 216.0, 205.0], dtype=np.float32)
    c_hi = np.array([232.0, 230.0, 223.0], dtype=np.float32)

    low_t = np.clip(t_mix / 0.55, 0.0, 1.0)[..., None]
    hi_t = np.clip((t_mix - 0.55) / 0.45, 0.0, 1.0)[..., None]
    low_rgb = c_shadow * (1.0 - low_t) + c_mid * low_t
    hi_rgb = c_mid * (1.0 - hi_t) + c_hi * hi_t
    regraded_rgb = np.where((t_mix <= 0.55)[..., None], low_rgb, hi_rgb)

    regraded = matted.copy()
    regraded[..., :3] = np.clip(np.round(regraded_rgb), 0, 255).astype(np.uint8)

    tx0, ty0, tx1, ty1 = alpha_bbox(regraded, thresh=8)
    cropped = regraded[ty0:ty1, tx0:tx1]
    ch, cw = cropped.shape[:2]
    if cw > 1024:
        new_h = max(1, int(round(ch * (1024.0 / cw))))
        cropped = np.array(
            Image.fromarray(cropped, mode='RGBA').resize((1024, new_h), Image.Resampling.NEAREST),
            dtype=np.uint8,
        )
    elif cw < 640:
        cropped = np.array(
            Image.fromarray(cropped, mode='RGBA').resize((cw * 2, ch * 2), Image.Resampling.NEAREST),
            dtype=np.uint8,
        )

    faded = apply_edge_fade(cropped, left_frac=0.14, right_frac=0.0, bottom_frac=0.08)
    bled = bleed_rgb_into_transparent(faded, passes=12, alpha_thresh=16)
    return encode_webp(bled, out_path, quality=quality, alpha_q=96, exact=True)


def process_celestial_sky(out_path: Path, quality: int = 86) -> tuple[int, float]:
    gw, gh = 512, 192
    theta = (2.0 * math.pi * np.arange(gw, dtype=np.float32) / gw)[None, :]
    yn = (np.arange(gh, dtype=np.float32) / gh)[:, None]

    # Strictly integer horizontal harmonics of theta so x=0 matches x=gw seamlessly
    field = np.zeros((gh, gw), dtype=np.float32)
    harmonics = [
        (1, 19.0, 0.4, 0.32),
        (-2, 29.0, 1.3, 0.24),
        (3, 44.0, 2.1, 0.18),
        (-5, 68.0, 0.9, 0.14),
        (7, 95.0, 2.7, 0.08),
    ]
    for freq_x, freq_y, phase, amp in harmonics:
        warp = 0.22 * np.sin(theta * max(1, abs(freq_x) - 1) + phase)
        val = 0.5 + 0.5 * np.sin(
            theta * freq_x + yn * freq_y + warp * 4.5 + phase
        )
        # Sharpen slightly into thin wispy altostratus ribbons
        ribbon = np.power(val, 1.35)
        field += ribbon * amp

    # Soft horizon-to-zenith density modulation so bands float naturally across upper-mid sky
    strat_env = 0.35 + 0.65 * np.sin(np.clip(yn, 0.0, 1.0) * math.pi)
    scalar = np.clip((field - 0.18) / 0.72, 0.0, 1.0) * strat_env

    bayer = (
        np.array(
            [
                [0, 8, 2, 10],
                [12, 4, 14, 6],
                [3, 11, 1, 9],
                [15, 7, 13, 5],
            ],
            dtype=np.float32,
        )
        / 16.0
        - 0.5
    )
    bayer_tiled = np.tile(bayer, (gh // 4, gw // 4))

    palette = np.array(
        [
            [207, 201, 188],  # #cfc9bc faded taupe-grey
            [226, 221, 209],  # #e2ddd1 soft parchment
            [240, 234, 224],  # #f0eae0 warm ivory
            [241, 237, 228],  # #f1ede4 pale parchment
        ],
        dtype=np.uint8,
    )
    scaled = np.clip(scalar * 3.0 + bayer_tiled * 0.72, 0.0, 2.999)
    idx = np.clip(np.round(scaled).astype(np.int32), 0, 3)
    rgb = palette[idx]

    # Smooth vertical alpha envelope (bottom 18% & top 6% fade smoothly to 0)
    bot_fade = np.clip((1.0 - yn) / 0.18, 0.0, 1.0)
    top_fade = np.clip(yn / 0.06, 0.0, 1.0)
    env = (0.5 - 0.5 * np.cos(math.pi * bot_fade)) * (0.5 - 0.5 * np.cos(math.pi * top_fade))
    alpha = np.clip(np.round((95.0 + scalar * 120.0) * env), 0, 215).astype(np.uint8)

    grid_rgba = np.dstack([rgb, alpha])
    upscaled = np.array(
        Image.fromarray(grid_rgba, mode='RGBA').resize((gw * 2, gh * 2), Image.Resampling.NEAREST),
        dtype=np.uint8,
    )
    byte_size = encode_webp(upscaled, out_path, quality=quality, alpha_q=98, exact=True)
    field_seam = float(np.max(np.abs(field[:, 0] - field[:, -1])))
    decoded = load_rgba(out_path).astype(np.float32)
    # Compare matching Bayer-grid phase (x=0 vs x=-4) after lossy WebP encoding
    seam_diff = float(np.mean(np.abs(decoded[:, 0, :] - decoded[:, -4, :])))
    if field_seam > 0.05 or seam_diff >= 4.0:
        raise RuntimeError(f'{out_path.name} seam diff field={field_seam:.3f} webp={seam_diff:.2f}!')
    return byte_size, seam_diff


def _build_seamless_cloud_layer(
    raw_path: Path,
    out_path: Path,
    quality: int,
    blur_radius: float,
    lum_gamma: float,
    opacity_scale: float,
    shadow_rgb: tuple[float, float, float],
    highlight_rgb: tuple[float, float, float],
    sculpt_canyon_rim: bool,
) -> tuple[int, float]:
    target_w, target_h = 2048, 384
    overlap = 360
    src_w = target_w + overlap

    raw_src = load_rgba(raw_path)
    bg_src = sample_border_bg(raw_src[..., :3].astype(np.float32), pad=6).astype(np.uint8)
    if raw_path.name == 'clouds-raw.png':
        raw_src[286:, :, :3] = bg_src[None, None, :]
    raw_img = (
        Image.fromarray(raw_src, mode='RGBA')
        .resize((src_w, target_h), Image.Resampling.LANCZOS)
        .filter(ImageFilter.GaussianBlur(radius=blur_radius))
    )
    raw = np.array(raw_img, dtype=np.uint8)
    rgb = raw[..., :3].astype(np.float32)

    bg_rgb = sample_border_bg(rgb, pad=6)
    dist = np.linalg.norm(rgb - bg_rgb[None, None, :], axis=-1)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    bg_lum = float(0.299 * bg_rgb[0] + 0.587 * bg_rgb[1] + 0.114 * bg_rgb[2])

    lum_norm = np.clip((lum - bg_lum - 8.0) / max(40.0, 218.0 - bg_lum), 0.0, 1.0)
    dist_norm = np.clip((dist - 12.0) / 110.0, 0.0, 1.0)
    alpha = np.power(np.maximum(lum_norm, dist_norm * 0.92), lum_gamma) * opacity_scale

    shadow_col = np.array(shadow_rgb, dtype=np.float32)[None, None, :]
    highlight_col = np.array(highlight_rgb, dtype=np.float32)[None, None, :]
    shade_t = np.clip(lum_norm * 1.15, 0.0, 1.0)[..., None]
    clean_rgb = shadow_col * (1.0 - shade_t) + highlight_col * shade_t

    y_norm = np.linspace(0.0, 1.0, target_h, dtype=np.float32)[:, None]
    if sculpt_canyon_rim:
        # Keep upper 28..42% open with periodic wave so citadel, aqueduct & hills show clearly above canyon mist
        u_wave = np.linspace(0.0, 1.0, src_w, dtype=np.float32)[None, :]
        top_start = 0.24 + 0.16 * (0.5 - 0.5 * np.cos(2.0 * math.pi * u_wave))
        top_fade = np.clip((y_norm - top_start) / 0.28, 0.0, 1.0)
        bot_fade = np.clip((1.0 - y_norm) / 0.24, 0.0, 1.0)
    else:
        top_fade = np.clip(y_norm / 0.18, 0.0, 1.0)
        bot_fade = np.clip((1.0 - y_norm) / 0.18, 0.0, 1.0)
    vert_env = (0.5 - 0.5 * np.cos(math.pi * top_fade)) * (0.5 - 0.5 * np.cos(math.pi * bot_fade))
    alpha = alpha * vert_env

    rgba = np.empty((target_h, src_w, 4), dtype=np.float32)
    rgba[..., :3] = clean_rgb
    rgba[..., 3] = alpha

    # Horizontally tileable premultiplied-alpha overlap blend
    core = rgba[:, :target_w, :].copy()
    tail = rgba[:, target_w:, :]
    xs = np.linspace(0.0, 1.0, overlap, dtype=np.float32)[None, :, None]
    w_core = 0.5 - 0.5 * np.cos(math.pi * xs)
    w_tail = 1.0 - w_core

    a_core = core[:, :overlap, 3:4]
    a_tail = tail[:, :, 3:4]
    a_blend = w_core * a_core + w_tail * a_tail
    premult_blend = w_core * (core[:, :overlap, :3] * a_core) + w_tail * (tail[:, :, :3] * a_tail)
    rgb_blend = np.where(a_blend > 1e-4, premult_blend / np.maximum(a_blend, 1e-4), shadow_col)

    core[:, :overlap, :3] = rgb_blend
    core[:, :overlap, 3:4] = a_blend

    out_u8 = np.dstack([
        np.clip(np.round(core[..., :3]), 0, 255),
        np.clip(np.round(core[..., 3] * 255.0), 0, 255),
    ]).astype(np.uint8)
    pad_x = 16
    wrapped = np.concatenate([out_u8[:, -pad_x:, :], out_u8, out_u8[:, :pad_x, :]], axis=1)
    wrapped = bleed_rgb_into_transparent(wrapped, passes=12, alpha_thresh=12)
    out_u8 = wrapped[:, pad_x:-pad_x, :]
    byte_size = encode_webp(out_u8, out_path, quality=quality, alpha_q=95, exact=True)

    decoded = load_rgba(out_path).astype(np.float32)
    seam_diff = float(np.mean(np.abs(decoded[:, 0, :] - decoded[:, -1, :])))
    if seam_diff >= 4.0:
        raise RuntimeError(f'{out_path.name} seam diff {seam_diff:.2f} >= 4.0!')
    return byte_size, seam_diff


def process_clouds(raw_path: Path, out_path: Path, quality: int = 86) -> tuple[int, float]:
    if raw_path.name.startswith('cloud-wisps-v2-raw'):
        return _build_sparse_seamless_clouds(raw_path, out_path, quality=quality, opacity_scale=0.68, band_mode='valley')
    return _build_seamless_cloud_layer(
        raw_path=raw_path,
        out_path=out_path,
        quality=quality,
        blur_radius=1.7,
        lum_gamma=0.70,
        opacity_scale=0.88,
        shadow_rgb=(218.0, 221.0, 226.0),
        highlight_rgb=(248.0, 246.0, 238.0),
        sculpt_canyon_rim=True,
    )


def process_cloud_wisps(raw_path: Path, out_path: Path, quality: int = 86) -> tuple[int, float]:
    if raw_path.name.startswith('cloud-wisps-v2-raw'):
        return _build_sparse_seamless_clouds(raw_path, out_path, quality=quality, opacity_scale=0.78, band_mode='wisps')
    return _build_seamless_cloud_layer(
        raw_path=raw_path,
        out_path=out_path,
        quality=quality,
        blur_radius=1.6,
        lum_gamma=0.72,
        opacity_scale=0.95,
        shadow_rgb=(222.0, 225.0, 230.0),
        highlight_rgb=(249.0, 247.0, 240.0),
        sculpt_canyon_rim=False,
    )


def _build_sparse_seamless_clouds(
    raw_path: Path,
    out_path: Path,
    quality: int,
    opacity_scale: float,
    band_mode: str,
) -> tuple[int, float]:
    raw = load_rgba(raw_path)
    bg_rgb = sample_border_bg(raw[..., :3].astype(np.float32), pad=6)
    matted = extract_bg_matte(
        raw,
        lo_dist=16.0,
        hi_dist=44.0,
        border_flood=False,
        bg_rgb=bg_rgb,
        decontaminate=True,
    )
    h, w = matted.shape[:2]
    # Keep wide open transparent gaps (>75% empty) so clouds are sparse drifting wisps, never a horizontal wall
    canvas = np.zeros((384, 2048, 4), dtype=np.uint8)
    slots = (
        [(140, 120, 420, 320, 88), (820, 160, 1140, 340, 108), (1540, 90, 1860, 280, 74)]
        if band_mode == 'wisps'
        else [(120, 140, 480, 350, 140), (740, 175, 1120, 360, 120), (1460, 130, 1820, 340, 132)]
    )
    # Extract 3 clean individual puff regions from raw (middle puff, left-center puff, right puff)
    crops = [
        matted[14 : min(h, 94), 320 : min(w, 570)],
        matted[82 : min(h, 172), 115 : min(w, 340)],
        matted[100 : min(h, 178), 570 : min(w, 725)],
    ]
    for crop_arr, (dx0, dy0, dx1, _dy1, pad_y) in zip(crops, slots):
        if crop_arr.size == 0 or not np.any(crop_arr[..., 3] > 20):
            continue
        x0, y0, x1, y1 = alpha_bbox(crop_arr, thresh=10)
        tight = apply_edge_fade(crop_arr[y0:y1, x0:x1], left_frac=0.14, right_frac=0.14, top_frac=0.12, bottom_frac=0.18)
        tw = dx1 - dx0
        th = max(24, int(round(tight.shape[0] * (tw / max(1, tight.shape[1])))))
        resized = np.array(
            Image.fromarray(tight, mode='RGBA').resize((tw, th), Image.Resampling.LANCZOS),
            dtype=np.uint8,
        )
        alpha_composite_over(canvas, resized, dx0, min(384 - th - 12, pad_y))

    soft = np.array(
        Image.fromarray(canvas, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=1.1)),
        dtype=np.float32,
    )
    soft[..., 3] = np.clip(soft[..., 3] * opacity_scale, 0.0, 255.0)
    out_u8 = np.round(soft).astype(np.uint8)
    # Initialize fully transparent pixels uniformly before horizontal wrap-bleed so tile seam stays spotless
    zero_mask = out_u8[..., 3] == 0
    out_u8[zero_mask, :3] = (220, 224, 226)
    pad_x = 16
    wrapped = np.concatenate([out_u8[:, -pad_x:, :], out_u8, out_u8[:, :pad_x, :]], axis=1)
    wrapped = bleed_rgb_into_transparent(wrapped, passes=12, alpha_thresh=10)
    out_u8 = wrapped[:, pad_x:-pad_x, :]
    byte_size = encode_webp(out_u8, out_path, quality=quality, alpha_q=95, exact=True)
    decoded = load_rgba(out_path).astype(np.float32)
    seam_diff = float(np.mean(np.abs(decoded[:, 0, :] - decoded[:, -1, :])))
    if seam_diff >= 4.0:
        raise RuntimeError(f'{out_path.name} seam diff {seam_diff:.2f} >= 4.0!')
    return byte_size, seam_diff


def extract_quadrant_sprites(raw_path: Path, bg_mode: str) -> list[np.ndarray]:
    raw = load_rgba(raw_path)
    h, w = raw.shape[:2]
    half_h, half_w = h // 2, w // 2
    if bg_mode == 'light':
        lo_dist, hi_dist, interior = 18.0, 62.0, 22.0
    else:
        lo_dist, hi_dist, interior = 16.0, 56.0, 18.0
    bg_rgb = sample_border_bg(raw[..., :3].astype(np.float32), pad=8)

    sprites: list[np.ndarray] = []
    for row in range(2):
        for col in range(2):
            quad = raw[row * half_h : (row + 1) * half_h, col * half_w : (col + 1) * half_w]
            matted = extract_bg_matte(
                quad,
                lo_dist=lo_dist,
                hi_dist=hi_dist,
                border_flood=True,
                clear_interior_dist=interior,
                bg_rgb=bg_rgb,
                decontaminate=True,
            )
            x0, y0, x1, y1 = alpha_bbox(matted, thresh=6)
            sprites.append(matted[y0:y1, x0:x1])
    return sprites


def alpha_composite_over(canvas: np.ndarray, sprite: np.ndarray, dst_x: int, dst_y: int) -> None:
    ch, cw = canvas.shape[:2]
    sh, sw = sprite.shape[:2]
    x0 = max(0, dst_x)
    y0 = max(0, dst_y)
    x1 = min(cw, dst_x + sw)
    y1 = min(ch, dst_y + sh)
    if x0 >= x1 or y0 >= y1:
        return

    sx0, sy0 = x0 - dst_x, y0 - dst_y
    sx1, sy1 = sx0 + (x1 - x0), sy0 + (y1 - y0)

    src = sprite[sy0:sy1, sx0:sx1].astype(np.float32)
    dst = canvas[y0:y1, x0:x1].astype(np.float32)

    sa = src[..., 3:4] / 255.0
    da = dst[..., 3:4] / 255.0
    out_a = sa + da * (1.0 - sa)
    safe_a = np.maximum(out_a, 1e-5)
    out_rgb = (src[..., :3] * sa + dst[..., :3] * da * (1.0 - sa)) / safe_a

    canvas[y0:y1, x0:x1, :3] = np.clip(np.round(out_rgb), 0, 255).astype(np.uint8)
    canvas[y0:y1, x0:x1, 3:4] = np.clip(np.round(out_a * 255.0), 0, 255).astype(np.uint8)


def process_foreground_lip(
    leaves_raw: Path,
    bells_raw: Path,
    out_path: Path,
    quality: int = 86,
) -> int:
    leaf_sprites = extract_quadrant_sprites(leaves_raw, bg_mode='light')
    bell_sprites = extract_quadrant_sprites(bells_raw, bg_mode='dark')

    target_w, target_h = 2560, 384
    canvas = np.zeros((target_h, target_w, 4), dtype=np.uint8)
    rng = np.random.default_rng(0x56504C49)

    def place_botanical(
        sprite: np.ndarray,
        center_x: int,
        bottom_y: int,
        scale: float,
        angle_deg: float,
        flip_x: bool,
        rgb_gain: float,
    ) -> None:
        pil = Image.fromarray(sprite, mode='RGBA')
        if flip_x:
            pil = pil.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        nw = max(8, int(round(pil.width * scale)))
        nh = max(8, int(round(pil.height * scale)))
        pil = pil.resize((nw, nh), Image.Resampling.LANCZOS)
        pil = pil.rotate(angle_deg, resample=Image.Resampling.BICUBIC, expand=True)
        arr = np.array(pil, dtype=np.uint8)
        arr[..., :3] = np.clip(
            np.round(arr[..., :3].astype(np.float32) * rgb_gain), 0, 255
        ).astype(np.uint8)
        alpha_composite_over(canvas, arr, center_x - arr.shape[1] // 2, bottom_y - arr.shape[0])

    # Layer 1: Dense back-lip sage leaf clumps (~52 clumps)
    for i in range(52):
        cx = int(-40 + (i / 51.0) * (target_w + 80) + rng.uniform(-22, 22))
        by = int(rng.uniform(352, 412))
        scale = float(rng.uniform(0.46, 0.62))
        angle = float(rng.uniform(-12.0, 12.0))
        flip = bool(rng.integers(0, 2))
        place_botanical(leaf_sprites[i % len(leaf_sprites)], cx, by, scale, angle, flip, 0.72)

    # Layer 2: Mid-lip bright ivory arching lily bells (~46 stems peeking between leaves)
    for i in range(46):
        cx = int(-20 + (i / 45.0) * (target_w + 40) + rng.uniform(-24, 24))
        by = int(rng.uniform(346, 396))
        scale = float(rng.uniform(0.42, 0.56))
        angle = float(rng.uniform(-10.0, 10.0))
        flip = bool(rng.integers(0, 2))
        place_botanical(bell_sprites[i % len(bell_sprites)], cx, by, scale, angle, flip, 1.06)

    # Soft dark-sage undergrowth shadow skirt sealing the lowest 28%
    skirt = np.zeros((target_h, target_w, 4), dtype=np.uint8)
    y_norm = np.linspace(0.0, 1.0, target_h, dtype=np.float32)[:, None]
    skirt_t = np.clip((y_norm - 0.72) / 0.28, 0.0, 1.0)
    skirt_alpha = np.round((0.5 - 0.5 * np.cos(np.pi * skirt_t)) * 240.0).astype(np.uint8)
    skirt[..., 0] = 35
    skirt[..., 1] = 46
    skirt[..., 2] = 37
    skirt[..., 3] = skirt_alpha
    alpha_composite_over(canvas, skirt, 0, 0)

    # Layer 3: Lush close-up foreground leaves (~48 broad clumps)
    for i in range(48):
        cx = int(-40 + (i / 47.0) * (target_w + 80) + rng.uniform(-22, 22))
        by = int(rng.uniform(382, 444))
        scale = float(rng.uniform(0.50, 0.68))
        angle = float(rng.uniform(-11.0, 11.0))
        flip = bool(rng.integers(0, 2))
        place_botanical(leaf_sprites[(i + 2) % len(leaf_sprites)], cx, by, scale, angle, flip, 0.56)

    # Gentle overall painterly softness + progressive knee-deep bokeh blur along bottom 32%
    soft = np.array(
        Image.fromarray(canvas, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=0.7)),
        dtype=np.float32,
    )
    blurred = np.array(
        Image.fromarray(canvas, mode='RGBA').filter(ImageFilter.GaussianBlur(radius=3.2)),
        dtype=np.float32,
    )
    y_coords = np.linspace(0.0, 1.0, target_h, dtype=np.float32)[:, None, None]
    blur_t = np.clip((y_coords - 0.68) / 0.32, 0.0, 1.0)
    mixed = soft * (1.0 - blur_t) + blurred * blur_t
    out_final = np.clip(np.round(mixed), 0, 255).astype(np.uint8)
    out_final = bleed_rgb_into_transparent(out_final, passes=14, alpha_thresh=16)
    return encode_webp(out_final, out_path, quality=quality, alpha_q=95)


def process_landmark(raw_path: Path, out_path: Path, bg_mode: str) -> None:
    raw = load_rgba(raw_path)
    has_native_alpha = bool(np.any(raw[..., 3] < 250))
    if has_native_alpha:
        matted = raw
    else:
        if bg_mode == 'dark':
            lo_dist, hi_dist, interior = 16.0, 56.0, 16.0
        else:
            lo_dist, hi_dist, interior = 20.0, 62.0, 0.0
        matted = extract_bg_matte(
            raw,
            lo_dist=lo_dist,
            hi_dist=hi_dist,
            border_flood=True,
            clear_interior_dist=interior,
            decontaminate=True,
        )
    out = fit_and_anchor_bottom_center(
        matted,
        canvas_w=128,
        canvas_h=128,
        max_w=118,
        max_h=120,
        bottom_margin=3,
    )
    # Harmonize any vivid chartreuse moss highlights gently toward muted sage (#5b6e5d)
    rgb = out[..., :3].astype(np.float32)
    lum = 0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]
    green_excess = (rgb[..., 1] > rgb[..., 2] + 16.0) & (rgb[..., 1] >= rgb[..., 0] - 4.0) & (out[..., 3] > 20)
    if np.any(green_excess):
        sage = np.stack([lum * 0.88, lum * 1.02, lum * 0.89], axis=-1)
        rgb[green_excess] = np.clip(rgb[green_excess] * 0.45 + sage[green_excess] * 0.55, 0, 255)
        out[..., :3] = np.round(rgb).astype(np.uint8)

    out = bleed_rgb_into_transparent(out, passes=16, alpha_thresh=16)
    assert out.shape == (128, 128, 4)
    assert np.any(out[..., 3] > 200), f'Landmark {out_path.name} has no opaque body'
    save_rgba(out, out_path)


def update_manifest_ts(manifest_path: Path, placements: dict[str, dict[str, float]]) -> None:
    text = manifest_path.read_text(encoding='utf-8')
    for key, vals in placements.items():
        block_re = re.compile(
            rf'({key}:\s*\{{[\s\S]*?offsetX:\s*)[-\d.]+(,\s*offsetY:\s*)[-\d.]+(,\s*worldWidth:\s*)[-\d.]+(,\s*worldHeight:\s*)[-\d.]+',
        )
        match = block_re.search(text)
        if not match:
            raise RuntimeError(f'Could not locate plate block for {key} in {manifest_path}')
        replacement = (
            f"{match.group(1)}{vals['offsetX']}"
            f"{match.group(2)}{vals['offsetY']}"
            f"{match.group(3)}{vals['worldWidth']}"
            f"{match.group(4)}{vals['worldHeight']}"
        )
        text = text[: match.start()] + replacement + text[match.end() :]
    manifest_path.write_text(text, encoding='utf-8')


def main() -> int:
    parser = argparse.ArgumentParser(description='Process HD-2D Flower Hill 2D assets.')
    parser.add_argument('--input-dir', type=Path, required=True, help='Directory holding raw assets.')
    parser.add_argument('--output-dir', type=Path, default=Path('public/assets'), help='Target public/assets directory.')
    parser.add_argument('--update-manifest', type=Path, default=None, help='Optional path to src/assets/manifest.ts.')
    args = parser.parse_args()

    inp: Path = args.input_dir
    out: Path = args.output_dir

    # A. Hero
    hero_out = out / 'sprites' / 'hero.png'
    process_hero(inp / 'hero', hero_out, debug_out_path=inp / 'debug-hero-4x.png')

    # B. Foliage
    leaves_raw = find_raw_file(inp / 'foliage', 'lily-leaves-raw')
    bells_raw = find_raw_file(inp / 'foliage', 'lily-bells-raw')
    process_foliage_atlas(leaves_raw, out / 'foliage' / 'lily-leaves.png', bg_mode='light')
    process_foliage_atlas(bells_raw, out / 'foliage' / 'lily-bells.png', bg_mode='dark')

    # C. Backdrop & Foreground WebP Plates (with automatic quality step-down if >= 2.5 MB)
    backdrop_dir = inp / 'backdrop'
    citadel_main_raw = (
        backdrop_dir / 'citadel-user-v4-raw.png'
        if (backdrop_dir / 'citadel-user-v4-raw.png').exists()
        else backdrop_dir / 'citadel-valley-v3-raw.png'
        if (backdrop_dir / 'citadel-valley-v3-raw.png').exists()
        else backdrop_dir / 'citadel-valley-v2-raw.png'
        if (backdrop_dir / 'citadel-valley-v2-raw.png').exists()
        else backdrop_dir / 'citadel-main-raw.png'
        if (backdrop_dir / 'citadel-main-raw.png').exists()
        else find_raw_file(backdrop_dir, 'citadel-raw')
    )
    citadel_hills_raw = (
        None
        if citadel_main_raw.name.startswith(
            ('citadel-user-v4-raw', 'citadel-valley-v3-raw', 'citadel-valley-v2-raw')
        )
        else backdrop_dir / 'citadel-hills-raw.png'
        if (backdrop_dir / 'citadel-hills-raw.png').exists()
        else None
    )
    ghost_raw = (
        backdrop_dir / 'far-mountains-v2-raw.png'
        if (backdrop_dir / 'far-mountains-v2-raw.png').exists()
        else backdrop_dir / 'ghost-castle-vista-raw.png'
        if (backdrop_dir / 'ghost-castle-vista-raw.png').exists()
        else find_raw_file(backdrop_dir, 'ghost-castle-raw')
    )
    watchtower_raw = (
        backdrop_dir / 'watchtower-sanctuary-v3-raw.png'
        if (backdrop_dir / 'watchtower-sanctuary-v3-raw.png').exists()
        else backdrop_dir / 'watchtower-cliff-v2-raw.png'
        if (backdrop_dir / 'watchtower-cliff-v2-raw.png').exists()
        else find_raw_file(backdrop_dir, 'watchtower-raw')
    )
    cloud_bank_raw = (
        backdrop_dir / 'clouds-rich-raw.png'
        if (backdrop_dir / 'clouds-rich-raw.png').exists()
        else find_raw_file(backdrop_dir, 'clouds-raw')
    )
    clouds_raw = (
        backdrop_dir / 'cloud-wisps-v2-raw.png'
        if (backdrop_dir / 'cloud-wisps-v2-raw.png').exists()
        else backdrop_dir / 'clouds-rich-raw.png'
        if (backdrop_dir / 'clouds-rich-raw.png').exists()
        else find_raw_file(backdrop_dir, 'clouds-raw')
    )
    cloud_wisps_raw = (
        backdrop_dir / 'cloud-wisps-v2-raw.png'
        if (backdrop_dir / 'cloud-wisps-v2-raw.png').exists()
        else find_raw_file(backdrop_dir, 'cloud-wisps-raw')
    )

    placements: dict[str, dict[str, float]] = {}
    plate_sizes: dict[str, int] = {}
    seam_diff = 0.0
    wisps_seam_diff = 0.0
    sky_seam_diff = 0.0
    for quality in (86, 78):
        placements['citadel'], plate_sizes['citadel.webp'] = process_citadel(
            citadel_main_raw, citadel_hills_raw, out / 'backdrop' / 'citadel.webp', quality=quality
        )
        placements['ghostCastle'], plate_sizes['ghost-castle.webp'] = process_ghost_castle(
            ghost_raw, out / 'backdrop' / 'ghost-castle.webp', quality=quality
        )
        placements['watchtower'], plate_sizes['watchtower.webp'] = process_watchtower(
            watchtower_raw, out / 'backdrop' / 'watchtower.webp', quality=quality
        )
        plate_sizes['clouds.webp'], seam_diff = process_clouds(
            clouds_raw, out / 'backdrop' / 'clouds.webp', quality=quality
        )
        plate_sizes['cloud-wisps.webp'], wisps_seam_diff = process_cloud_wisps(
            cloud_wisps_raw, out / 'backdrop' / 'cloud-wisps.webp', quality=quality
        )
        plate_sizes['cloud-bank-right.webp'] = process_cloud_bank_right(
            cloud_bank_raw, out / 'backdrop' / 'cloud-bank-right.webp', quality=quality
        )
        plate_sizes['celestial-sky.webp'], sky_seam_diff = process_celestial_sky(
            out / 'backdrop' / 'celestial-sky.webp', quality=quality
        )
        plate_sizes['foreground-lip.webp'] = process_foreground_lip(
            leaves_raw, bells_raw, out / 'backdrop' / 'foreground-lip.webp', quality=quality
        )
        total_webp = sum(plate_sizes.values())
        if total_webp < MAX_BACKDROP_WEBP_BYTES:
            break

    total_webp = sum(plate_sizes.values())
    if total_webp >= MAX_BACKDROP_WEBP_BYTES:
        print(f'ERROR: Combined backdrop WebP payload {total_webp} bytes >= {MAX_BACKDROP_WEBP_BYTES}', file=sys.stderr)
        return 1

    # D. Landmarks
    landmark_modes = {
        'about': 'dark',
        'works': 'light',
        'interests': 'light',
        'contact': 'light',
    }
    for name, mode in landmark_modes.items():
        lm_raw = find_raw_file(inp / 'landmarks', f'{name}-raw')
        process_landmark(lm_raw, out / 'landmarks' / f'{name}.png', bg_mode=mode)

    # Validate key layout invariants before touching manifest.ts
    cit = placements['citadel']
    gc = placements['ghostCastle']
    wt = placements['watchtower']
    if cit['offsetX'] - cit['worldWidth'] * 0.5 > -33.515:
        raise RuntimeError(f'citadel left edge {cit["offsetX"] - cit["worldWidth"] * 0.5:.2f} > -33.515!')
    if gc['offsetX'] <= 0:
        raise RuntimeError(f'ghostCastle offsetX {gc["offsetX"]} <= 0!')
    wt_top_world_y = wt['offsetY'] + wt['worldHeight'] * 0.5
    if wt_top_world_y < 15.87:
        raise RuntimeError(f'watchtower topWorldY {wt_top_world_y:.2f} < 15.87 (85% of 4:3 screen)!')

    if args.update_manifest is not None:
        update_manifest_ts(args.update_manifest, placements)

    print('=== Processed Asset Summary ===')
    for rel in [
        'sprites/hero.png',
        'foliage/lily-leaves.png',
        'foliage/lily-bells.png',
        'backdrop/citadel.webp',
        'backdrop/ghost-castle.webp',
        'backdrop/watchtower.webp',
        'backdrop/clouds.webp',
        'backdrop/cloud-wisps.webp',
        'backdrop/cloud-bank-right.webp',
        'backdrop/celestial-sky.webp',
        'backdrop/foreground-lip.webp',
        'landmarks/about.png',
        'landmarks/works.png',
        'landmarks/interests.png',
        'landmarks/contact.png',
    ]:
        p = out / rel
        w, h = Image.open(p).size
        print(f'  {rel:34s} {w:4d}x{h:<4d}  {p.stat().st_size:8d} bytes')

    print(f'\nTotal WebP backdrop payload: {total_webp / 1024:.1f} KB / {MAX_BACKDROP_WEBP_BYTES / 1024:.0f} KB budget')
    print(f'clouds.webp seam delta: {seam_diff:.3f} | cloud-wisps.webp seam delta: {wisps_seam_diff:.3f} | celestial-sky.webp seam delta: {sky_seam_diff:.3f}')
    print('\nManifest cropPixelsToManifest values:')
    print(json.dumps(placements, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
