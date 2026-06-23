#!/usr/bin/env python3
"""
extract_frames.py — Extract frames from a video as WebP images at multiple resolutions.

Extracts evenly-spaced frames from a video for scroll-frame web animations (Apple-style).
Produces desktop (1920x1080) and mobile (960x540) WebP frames plus a manifest.json.

Usage:
    python extract_frames.py --input video.mp4 --output output/frames [options]

Dependencies:
    - FFmpeg + FFprobe (must be installed and available on PATH)
    - Python 3.7+

Cross-platform: Windows, macOS, Linux.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_DESKTOP_RES = (1920, 1080)
DEFAULT_MOBILE_RES = (960, 540)
DEFAULT_QUALITY = 85
DEFAULT_FRAMES_AUTO_FACTOR = 10  # frames per second when auto-calculating
MAX_FRAMES_AUTO = 200
MIN_FRAMES = 2
FRAME_FILENAME_PATTERN = "frame-{index:04d}.webp"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def find_executable(name: str) -> Optional[str]:
    """Locate an executable on PATH, with fallback paths for Windows."""
    exe = shutil.which(name)
    if exe:
        return exe

    if sys.platform == "win32":
        # Common FFmpeg install locations on Windows
        fallback_roots = [
            r"C:\ffmpeg\bin",
            r"C:\Program Files\ffmpeg\bin",
            r"C:\Program Files\FFmpeg\bin",
            os.path.expanduser(r"~\scoop\apps\ffmpeg\current\bin"),
            os.path.expanduser(r"~\AppData\Local\Microsoft\WinGet\Packages\FFmpeg_Microsoft\FFmpeg\bin"),
        ]
        for root in fallback_roots:
            candidate = os.path.join(root, f"{name}.exe")
            if os.path.isfile(candidate):
                return candidate

    return None


def run_subprocess(
    cmd: List[str],
    description: str = "",
    capture_output: bool = False,
) -> subprocess.CompletedProcess:
    """Run a subprocess with error handling and optional output capture."""
    try:
        if capture_output:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=False,
            )
        else:
            result = subprocess.run(cmd, check=False)
    except FileNotFoundError:
        print(f"  [ERROR] Command not found: {cmd[0]}")
        print(f"          Is {cmd[0]} installed and on PATH?")
        sys.exit(1)
    except OSError as exc:
        print(f"  [ERROR] Failed to run {description or cmd[0]}: {exc}")
        sys.exit(1)

    if result.returncode != 0:
        stderr = result.stderr.strip() if result.stderr else "(no stderr)"
        print(f"  [ERROR] {description or 'Command'} failed (exit code {result.returncode})")
        if stderr:
            # Show last few lines of stderr for context
            lines = stderr.splitlines()
            for line in lines[-5:]:
                print(f"          {line}")
        sys.exit(1)

    return result


# ---------------------------------------------------------------------------
# Video probing
# ---------------------------------------------------------------------------

def probe_video(video_path: str, ffprobe_path: str) -> Dict[str, Any]:
    """Analyze video with ffprobe and return structured metadata.

    Returns a dict with keys:
        duration, width, height, fps, codec, estimated_frames, has_audio, bitrate
    """
    cmd = [
        ffprobe_path,
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        video_path,
    ]

    result = run_subprocess(cmd, description="ffprobe video analysis", capture_output=True)

    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        print(f"  [ERROR] Failed to parse ffprobe output: {exc}")
        sys.exit(1)

    # Locate the first video stream
    video_stream = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            video_stream = stream
            break

    if video_stream is None:
        print("  [ERROR] No video stream found in the input file.")
        sys.exit(1)

    # --- Duration ---
    duration_str = video_stream.get("duration") or data.get("format", {}).get("duration", "0")
    try:
        duration = float(duration_str)
    except (ValueError, TypeError):
        duration = 0.0

    if duration <= 0:
        print("  [ERROR] Could not determine video duration.")
        sys.exit(1)

    # --- Resolution ---
    width = int(video_stream.get("width", 0))
    height = int(video_stream.get("height", 0))
    if width == 0 or height == 0:
        print("  [ERROR] Could not determine video resolution.")
        sys.exit(1)

    # --- Frame rate ---
    fps: float = 0.0
    r_frame_rate = video_stream.get("r_frame_rate", "0/1")
    if "/" in r_frame_rate:
        try:
            num, den = r_frame_rate.split("/")
            fps = float(num) / float(den)
        except (ValueError, ZeroDivisionError):
            fps = 0.0

    if fps <= 0:
        avg_frame_rate = video_stream.get("avg_frame_rate", "0/1")
        if "/" in avg_frame_rate:
            try:
                num, den = avg_frame_rate.split("/")
                fps = float(num) / float(den)
            except (ValueError, ZeroDivisionError):
                fps = 0.0

    if fps <= 0:
        print("  [WARNING] Could not determine frame rate, assuming 30 fps.")
        fps = 30.0

    # --- Codec ---
    codec = video_stream.get("codec_name", "unknown")

    # --- Estimated total frames ---
    estimated_frames = video_stream.get("nb_frames")
    if estimated_frames is not None:
        estimated_frames = int(estimated_frames)
    else:
        estimated_frames = int(round(duration * fps))

    # --- Audio ---
    has_audio = any(s.get("codec_type") == "audio" for s in data.get("streams", []))

    # --- Bitrate ---
    bitrate = video_stream.get("bit_rate") or data.get("format", {}).get("bit_rate", "0")
    try:
        bitrate = int(bitrate)
    except (ValueError, TypeError):
        bitrate = 0

    return {
        "duration": duration,
        "width": width,
        "height": height,
        "fps": round(fps, 3),
        "codec": codec,
        "estimated_frames": estimated_frames,
        "has_audio": has_audio,
        "bitrate": bitrate,
    }


# ---------------------------------------------------------------------------
# Frame extraction
# ---------------------------------------------------------------------------

def format_timestamp(seconds: float) -> str:
    """Convert seconds to HH:MM:SS.mmm timestamp for FFmpeg."""
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = seconds % 60
    return f"{hours:02d}:{minutes:02d}:{secs:06.3f}"


def calculate_frame_positions(duration: float, num_frames: int) -> List[float]:
    """Calculate evenly spaced frame positions in seconds.

    The first frame is at 0.0 and the last at ``duration`` (exclusive — slightly
    before the very end to avoid black frames on some codecs).
    """
    if num_frames <= 1:
        return [0.0]

    # End slightly before the true duration to avoid black/incomplete frames
    end = max(0.0, duration - (1.0 / 30.0))

    interval = end / (num_frames - 1)
    return [i * interval for i in range(num_frames)]


def extract_frame(
    ffmpeg_path: str,
    video_path: str,
    position: float,
    output_path: str,
    width: int,
    height: int,
    quality: int,
) -> None:
    """Extract a single frame at ``position`` as a WebP image.

    Uses selective seeking (-ss before -i) for speed, with a single
    decoded frame via -frames:v 1 and exact position via -vsync 0.
    """
    cmd = [
        ffmpeg_path,
        "-ss", format_timestamp(position),
        "-i", video_path,
        "-vf", f"scale={width}:{height}:flags=lanczos",
        "-vcodec", "libwebp",
        "-lossless", "0",
        "-compression_level", "6",
        "-qscale", str(quality),
        "-preset", "picture",
        "-vsync", "0",
        "-frames:v", "1",
        "-y",  # overwrite without asking
        output_path,
    ]

    run_subprocess(cmd, description=f"extract frame at {format_timestamp(position)}")


def extract_frames_batch(
    ffmpeg_path: str,
    video_path: str,
    positions: List[float],
    output_dir: str,
    width: int,
    height: int,
    quality: int,
    label: str,
) -> List[Dict[str, Any]]:
    """Extract frames at all given positions and return per-frame metadata.

    Args:
        label: Human-readable label for progress output (e.g., "desktop").
    """
    os.makedirs(output_dir, exist_ok=True)
    metadata_list: List[Dict[str, Any]] = []
    total = len(positions)

    for i, pos in enumerate(positions):
        filename = FRAME_FILENAME_PATTERN.format(index=i)
        output_path = os.path.join(output_dir, filename)

        extract_frame(ffmpeg_path, video_path, pos, output_path, width, height, quality)

        file_size = os.path.getsize(output_path)
        metadata_list.append({
            "index": i,
            "filename": filename,
            "timestamp": round(pos, 3),
            "width": width,
            "height": height,
            "size_bytes": file_size,
        })

        # Progress (overwrite line on TTY, use newlines for pipes)
        pct = (i + 1) / total * 100
        if sys.stdout.isatty():
            print(
                f"\r  [{label}] {i + 1:>{len(str(total))}}/{total} "
                f"({pct:5.1f}%) — {filename}",
                end="",
                flush=True,
            )
        else:
            print(f"  [{label}] {i + 1}/{total} ({pct:.1f}%) — {filename}")

    if sys.stdout.isatty():
        print()  # final newline after progress

    return metadata_list


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------

def write_manifest(
    manifest_path: str,
    video_info: Dict[str, Any],
    desktop_meta: List[Dict[str, Any]],
    mobile_meta: List[Dict[str, Any]],
    args: argparse.Namespace,
    elapsed: float,
) -> None:
    """Write manifest.json with extraction metadata."""
    desktop_total = sum(m["size_bytes"] for m in desktop_meta)
    mobile_total = sum(m["size_bytes"] for m in mobile_meta) if mobile_meta else 0

    manifest = {
        "version": "1.0",
        "source_video": {
            "filename": os.path.basename(args.input),
            "duration_sec": video_info["duration"],
            "resolution": f"{video_info['width']}x{video_info['height']}",
            "fps": video_info["fps"],
            "codec": video_info["codec"],
            "estimated_frames": video_info["estimated_frames"],
            "has_audio": video_info["has_audio"],
        },
        "extraction": {
            "num_frames": args.frames,
            "quality": args.quality,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "elapsed_sec": round(elapsed, 2),
        },
        "desktop": {
            "count": len(desktop_meta),
            "resolution": f"{args.desktop_width}x{args.desktop_height}",
            "total_size_bytes": desktop_total,
            "total_size_mb": round(desktop_total / (1024 * 1024), 2),
            "frames": desktop_meta,
        },
        "mobile": {
            "count": len(mobile_meta),
            "resolution": f"{args.mobile_width}x{args.mobile_height}",
            "total_size_bytes": mobile_total,
            "total_size_mb": round(mobile_total / (1024 * 1024), 2),
            "frames": mobile_meta,
        } if mobile_meta else None,
    }

    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"  [MANIFEST] Written to {manifest_path}")


# ---------------------------------------------------------------------------
# Summaries
# ---------------------------------------------------------------------------

def print_video_summary(info: Dict[str, Any]) -> None:
    """Print a formatted video analysis summary."""
    print()
    print("  ┌─────────────────────────────────────────────┐")
    print("  │           VIDEO ANALYSIS                    │")
    print("  ├─────────────────────────────────────────────┤")
    print(f"  │  Duration:      {info['duration']:>8.2f}s{'':>15}│")
    print(f"  │  Resolution:    {info['width']:>4} x {info['height']:<4}{'':>16}│")
    print(f"  │  Frame Rate:    {info['fps']:>8.3f} fps{'':>12}│")
    print(f"  │  Total Frames:  {info['estimated_frames']:>8}{'':>15}│")
    print(f"  │  Codec:         {info['codec']:<8}{'':>15}│")
    print(f"  │  Audio:         {'Yes' if info['has_audio'] else 'No':<8}{'':>15}│")
    print("  └─────────────────────────────────────────────┘")
    print()


def print_extraction_summary(
    duration: float,
    num_frames: int,
    desktop_meta: List[Dict[str, Any]],
    mobile_meta: List[Dict[str, Any]],
    quality: int,
    desktop_res: Tuple[int, int],
    mobile_res: Tuple[int, int],
    elapsed: float,
) -> None:
    """Print a formatted extraction summary."""
    desktop_total = sum(m["size_bytes"] for m in desktop_meta) if desktop_meta else 0
    mobile_total = sum(m["size_bytes"] for m in mobile_meta) if mobile_meta else 0

    def fmt_size(b: int) -> str:
        if b < 1024:
            return f"{b} B"
        elif b < 1024 * 1024:
            return f"{b / 1024:.1f} KB"
        else:
            return f"{b / (1024 * 1024):.2f} MB"

    interval = duration / (num_frames - 1) if num_frames > 1 else duration

    print()
    print("  ┌─────────────────────────────────────────────┐")
    print("  │           EXTRACTION SUMMARY                │")
    print("  ├─────────────────────────────────────────────┤")
    print(f"  │  Frames extracted:  {num_frames:>5}{'':>15}│")
    print(f"  │  Interval:          {interval:.3f}s{'':>17}│")
    print(f"  │  WebP Quality:      {quality:>3}{'':>18}│")
    print(f"  │  Elapsed time:      {elapsed:.2f}s{'':>16}│")
    print("  ├─────────────────────────────────────────────┤")
    if desktop_meta:
        print(f"  │  Desktop ({desktop_res[0]}x{desktop_res[1]}):{'':>9}{fmt_size(desktop_total):>10}│")
    if mobile_meta:
        print(f"  │  Mobile  ({mobile_res[0]}x{mobile_res[1]}):{'':>10}{fmt_size(mobile_total):>10}│")
    if desktop_meta and mobile_meta:
        combined = desktop_total + mobile_total
        print(f"  │  Total:              {fmt_size(combined):>10}│")
    print("  └─────────────────────────────────────────────┘")
    print()


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

def parse_resolution(value: str) -> Tuple[int, int]:
    """Parse a 'WxH' resolution string, e.g. '1920x1080'."""
    try:
        parts = value.lower().split("x")
        if len(parts) != 2:
            raise ValueError
        w, h = int(parts[0]), int(parts[1])
        if w <= 0 or h <= 0:
            raise ValueError
        return (w, h)
    except (ValueError, AttributeError):
        raise argparse.ArgumentTypeError(
            f"Invalid resolution: '{value}'. Expected format: WxH (e.g. 1920x1080)."
        )


def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    """Parse and validate command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Extract frames from a video as WebP images for scroll-frame animation.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  %(prog)s --input video.mp4 --output output/frames\n"
            "  %(prog)s --input video.mp4 --output output/frames --frames 120 --quality 80\n"
            "  %(prog)s --input video.mp4 --output output/frames --desktop-only\n"
        ),
    )

    parser.add_argument(
        "--input", "-i",
        required=True,
        metavar="FILE",
        help="Path to the input video file (MP4, MOV, etc.).",
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        metavar="DIR",
        help="Root output directory for extracted frames.",
    )
    parser.add_argument(
        "--frames", "-n",
        type=int,
        default=None,
        metavar="N",
        help=(
            f"Number of frames to extract. Auto-calculated as "
            f"duration x {DEFAULT_FRAMES_AUTO_FACTOR} (max {MAX_FRAMES_AUTO}, min {MIN_FRAMES})."
        ),
    )
    parser.add_argument(
        "--quality", "-q",
        type=int,
        default=DEFAULT_QUALITY,
        metavar="Q",
        help=f"WebP quality 1-100 (default: {DEFAULT_QUALITY}).",
    )
    parser.add_argument(
        "--desktop-res",
        type=parse_resolution,
        default=f"{DEFAULT_DESKTOP_RES[0]}x{DEFAULT_DESKTOP_RES[1]}",
        metavar="WxH",
        help=f"Desktop frame resolution (default: {DEFAULT_DESKTOP_RES[0]}x{DEFAULT_DESKTOP_RES[1]}).",
    )
    parser.add_argument(
        "--mobile-res",
        type=parse_resolution,
        default=f"{DEFAULT_MOBILE_RES[0]}x{DEFAULT_MOBILE_RES[1]}",
        metavar="WxH",
        help=f"Mobile frame resolution (default: {DEFAULT_MOBILE_RES[0]}x{DEFAULT_MOBILE_RES[1]}).",
    )
    parser.add_argument(
        "--desktop-only",
        action="store_true",
        help="Extract only desktop frames (skip mobile).",
    )
    parser.add_argument(
        "--mobile-only",
        action="store_true",
        help="Extract only mobile frames (skip desktop).",
    )

    args = parser.parse_args(argv)

    # -- Validate quality --
    if not (1 <= args.quality <= 100):
        parser.error("--quality must be between 1 and 100.")

    # -- Validate frames --
    if args.frames is not None and args.frames < MIN_FRAMES:
        parser.error(f"--frames must be at least {MIN_FRAMES}.")

    # -- Validate exclusivity --
    if args.desktop_only and args.mobile_only:
        parser.error("--desktop-only and --mobile-only cannot be used together.")

    # -- Store resolutions as tuples --
    args.desktop_width, args.desktop_height = args.desktop_res
    args.mobile_width, args.mobile_height = args.mobile_res

    return args


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Entry point."""
    start_time = time.time()
    args = parse_args()

    # ------------------------------------------------------------------
    # 1. Locate executables
    # ------------------------------------------------------------------
    ffprobe_path = find_executable("ffprobe")
    ffmpeg_path = find_executable("ffmpeg")

    if not ffprobe_path:
        print("[ERROR] ffprobe not found. Install FFmpeg (includes ffprobe).")
        print("        Windows: winget install FFmpeg")
        print("        macOS:   brew install ffmpeg")
        print("        Linux:   sudo apt install ffmpeg")
        sys.exit(1)

    if not ffmpeg_path:
        print("[ERROR] ffmpeg not found. Install FFmpeg.")
        print("        Windows: winget install FFmpeg")
        print("        macOS:   brew install ffmpeg")
        print("        Linux:   sudo apt install ffmpeg")
        sys.exit(1)

    print(f"[FFPROBE] {ffprobe_path}")
    print(f"[FFMPEG]  {ffmpeg_path}")

    # ------------------------------------------------------------------
    # 2. Validate input
    # ------------------------------------------------------------------
    input_path = args.input
    if not os.path.isfile(input_path):
        print(f"[ERROR] Input file not found: {input_path}")
        sys.exit(1)

    # ------------------------------------------------------------------
    # 3. Probe video
    # ------------------------------------------------------------------
    print(f"\n[ANALYZE] Probing video: {input_path}")
    video_info = probe_video(input_path, ffprobe_path)
    print_video_summary(video_info)

    duration = video_info["duration"]

    # ------------------------------------------------------------------
    # 4. Determine number of frames
    # ------------------------------------------------------------------
    if args.frames is not None:
        num_frames = args.frames
    else:
        num_frames = min(
            max(MIN_FRAMES, int(round(duration * DEFAULT_FRAMES_AUTO_FACTOR))),
            MAX_FRAMES_AUTO,
        )
        print(f"[AUTO]   Frame count: duration x {DEFAULT_FRAMES_AUTO_FACTOR} = {num_frames}")

    # ------------------------------------------------------------------
    # 5. Calculate frame positions
    # ------------------------------------------------------------------
    positions = calculate_frame_positions(duration, num_frames)

    print(f"[PLAN]   {num_frames} frames at ~{duration / (num_frames - 1):.3f}s intervals")
    print(f"         Quality: {args.quality}")
    print(f"         Desktop: {args.desktop_width}x{args.desktop_height} "
          f"{'(skipped)' if args.mobile_only else ''}")
    print(f"         Mobile:  {args.mobile_width}x{args.mobile_height} "
          f"{'(skipped)' if args.desktop_only else ''}")
    print()

    # ------------------------------------------------------------------
    # 6. Create output directory structure
    # ------------------------------------------------------------------
    output_root = args.output
    desktop_dir = os.path.join(output_root, "desktop")
    mobile_dir = os.path.join(output_root, "mobile")

    os.makedirs(desktop_dir, exist_ok=True)
    if not args.desktop_only:
        os.makedirs(mobile_dir, exist_ok=True)

    # ------------------------------------------------------------------
    # 7. Extract frames
    # ------------------------------------------------------------------
    desktop_meta: List[Dict[str, Any]] = []
    mobile_meta: List[Dict[str, Any]] = []

    if not args.mobile_only:
        print(f"[EXTRACT] Desktop frames → {desktop_dir}")
        desktop_meta = extract_frames_batch(
            ffmpeg_path,
            input_path,
            positions,
            desktop_dir,
            args.desktop_width,
            args.desktop_height,
            args.quality,
            label="desktop",
        )
    else:
        print(f"[SKIP]    Desktop frames (--mobile-only active)")

    if not args.desktop_only:
        print(f"\n[EXTRACT] Mobile frames → {mobile_dir}")
        mobile_meta = extract_frames_batch(
            ffmpeg_path,
            input_path,
            positions,
            mobile_dir,
            args.mobile_width,
            args.mobile_height,
            args.quality,
            label="mobile",
        )
    else:
        print(f"\n[SKIP]    Mobile frames (--desktop-only active)")

    # ------------------------------------------------------------------
    # 8. Write manifest
    # ------------------------------------------------------------------
    elapsed = time.time() - start_time
    manifest_path = os.path.join(output_root, "manifest.json")
    write_manifest(
        manifest_path,
        video_info,
        desktop_meta,
        mobile_meta,
        args,
        elapsed,
    )

    # ------------------------------------------------------------------
    # 9. Summary
    # ------------------------------------------------------------------
    print_extraction_summary(
        duration,
        num_frames,
        desktop_meta,
        mobile_meta,
        args.quality,
        (args.desktop_width, args.desktop_height),
        (args.mobile_width, args.mobile_height),
        elapsed,
    )

    print(f"[DONE]    All frames extracted to: {os.path.abspath(output_root)}")
    print(f"         Desktop: {len(desktop_meta)} frame(s) — {desktop_dir}")
    print(f"         Mobile:  {len(mobile_meta)} frame(s) — {mobile_dir}")
    print(f"         Manifest: {manifest_path}")
    print()


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    main()
