"""
Extract one clear frame per second from PPE training videos.

Reads videos from private_training/videos/ only.
Does not read private_training/final_test/.
Does not train a model or modify videos.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import cv2
import numpy as np


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_VIDEO_DIR = PROJECT_ROOT / "private_training" / "videos"
V6_VIDEO_DIR = PROJECT_ROOT / "private_training" / "videos_v6"
OUTPUT_DIR = PROJECT_ROOT / "private_training" / "dataset" / "images" / "unlabelled"

VIDEO_EXTENSIONS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}

# Laplacian variance below this is treated as blurry.
MIN_SHARPNESS = 45.0
# Mean brightness below this is treated as extremely dark.
MIN_BRIGHTNESS = 28.0
# Mean absolute pixel difference below this is treated as nearly identical.
MIN_FRAME_DIFF = 6.5


def slugify(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    return cleaned.lower() or "video"


def is_blurry(gray: np.ndarray) -> bool:
    return float(cv2.Laplacian(gray, cv2.CV_64F).var()) < MIN_SHARPNESS


def is_too_dark(gray: np.ndarray) -> bool:
    return float(gray.mean()) < MIN_BRIGHTNESS


def is_nearly_identical(gray: np.ndarray, previous: np.ndarray | None) -> bool:
    if previous is None:
        return False
    if gray.shape != previous.shape:
        previous = cv2.resize(previous, (gray.shape[1], gray.shape[0]))
    difference = cv2.absdiff(gray, previous)
    return float(difference.mean()) < MIN_FRAME_DIFF


def list_training_videos(video_dir: Path) -> list[Path]:
    if not video_dir.exists():
        return []
    return sorted(
        path
        for path in video_dir.iterdir()
        if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )


def extract_from_video(
    video_path: Path,
    output_dir: Path,
    keep_dark: bool,
) -> dict:
    result = {
        "video": video_path.name,
        "extracted": 0,
        "skipped_blurry": 0,
        "skipped_dark": 0,
        "skipped_similar": 0,
        "failed": False,
        "error": "",
    }

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        result["failed"] = True
        result["error"] = "Could not open video."
        return result

    fps = float(capture.get(cv2.CAP_PROP_FPS) or 0)
    if fps <= 1:
        fps = 25.0

    frame_interval = max(1, int(round(fps)))
    video_slug = slugify(video_path.stem)
    previous_kept: np.ndarray | None = None
    frame_index = 0
    saved_index = 0

    while True:
        ok, frame = capture.read()
        if not ok:
            break

        take_this = frame_index % frame_interval == 0
        frame_index += 1
        if not take_this:
            continue

        if frame is None or frame.size == 0:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        if not keep_dark and is_too_dark(gray):
            result["skipped_dark"] += 1
            continue
        if is_blurry(gray):
            result["skipped_blurry"] += 1
            continue
        if is_nearly_identical(gray, previous_kept):
            result["skipped_similar"] += 1
            continue

        second = saved_index
        filename = f"{video_slug}_s{second:04d}_f{frame_index:06d}.jpg"
        save_path = output_dir / filename
        if save_path.exists():
            previous_kept = gray
            saved_index += 1
            result["extracted"] += 1
            continue
        saved = cv2.imwrite(str(save_path), frame, [int(cv2.IMWRITE_JPEG_QUALITY), 95])
        if not saved:
            result["failed"] = True
            result["error"] = f"Could not write {filename}."
            break

        previous_kept = gray
        saved_index += 1
        result["extracted"] += 1

    capture.release()

    if frame_index == 0 and not result["failed"]:
        result["failed"] = True
        result["error"] = "No frames could be read."

    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Extract PPE training frames from videos.",
    )
    parser.add_argument(
        "--video-dir",
        type=Path,
        default=None,
        help="Folder of videos. Default: private_training/videos",
    )
    parser.add_argument(
        "--v6",
        action="store_true",
        help="Read private_training/videos_v6 and keep dim lighting frames.",
    )
    parser.add_argument(
        "--keep-dark",
        action="store_true",
        help="Do not drop very dark frames (needed for lighting videos).",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    video_dir = args.video_dir or (V6_VIDEO_DIR if args.v6 else DEFAULT_VIDEO_DIR)
    keep_dark = bool(args.keep_dark or args.v6)
    videos = list_training_videos(video_dir)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    video_dir.mkdir(parents=True, exist_ok=True)

    print(f"Video folder: {video_dir}")
    print(f"Output folder: {OUTPUT_DIR}")
    print(f"Videos found: {len(videos)}")
    print(f"Keep dark frames: {keep_dark}")
    print("Skipping private_training/final_test/")
    print()

    summaries = []
    for video_path in videos:
        print(f"Processing {video_path.name} ...")
        summary = extract_from_video(video_path, OUTPUT_DIR, keep_dark)
        summaries.append(summary)
        if summary["failed"]:
            print(f"  FAILED: {summary['error']}")
        else:
            print(
                f"  extracted={summary['extracted']} "
                f"skipped_blurry={summary['skipped_blurry']} "
                f"skipped_dark={summary['skipped_dark']} "
                f"skipped_similar={summary['skipped_similar']}"
            )

    print()
    print("=== Summary ===")
    print(f"Videos processed: {len(summaries)}")
    total = 0
    failed = []
    for summary in summaries:
        print(f"- {summary['video']}: {summary['extracted']} frames")
        total += summary["extracted"]
        if summary["failed"]:
            failed.append(summary)
    print(f"Total extracted frames: {total}")
    if failed:
        print("Failed videos:")
        for summary in failed:
            print(f"- {summary['video']}: {summary['error']}")
    else:
        print("Failed videos: none")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
