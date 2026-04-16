"""
TruthLens — Dataset Preparation Script
=======================================
Downloads and prepares TWO datasets for combined training:

  [1] RAVDESS (more actors) — Zenodo public repository
      No credentials needed. Downloads MP4 videos, extracts frames.

  [2] FER2013 — 35,887 labeled 48x48 grayscale images
      Requires kaggle.json (free, 2-step setup — instructions printed below)
      OR provide the CSV path directly.

Usage:
  python3 prepare_data.py                        # Download all
  python3 prepare_data.py --fer-csv /path/to/fer2013.csv
  python3 prepare_data.py --skip-ravdess         # Only FER2013
  python3 prepare_data.py --skip-fer             # Only RAVDESS
"""

import os
import re
import sys
import cv2
import csv
import shutil
import zipfile
import argparse
import urllib.request
import numpy as np
from pathlib import Path

# =====================================================================
# CONFIG
# =====================================================================
# 7 emotions matching our model's training labels
emotion_labels = ['angry', 'disgust', 'fear', 'happy', 'neutral', 'sad', 'surprise']

# RAVDESS emotion codes (3rd segment of filename e.g. 01-01-03-XX-XX-XX-XX.mp4)
RAVDESS_EMOTION_MAP = {
    '01': 'neutral',    # neutral
    '02': 'neutral',    # calm  → nearest neighbour is neutral
    '03': 'happy',
    '04': 'sad',
    '05': 'angry',
    '06': 'fear',
    '07': 'disgust',
    '08': 'surprise'
}

# FER2013 emotion codes
FER_EMOTION_MAP = {
    0: 'angry', 1: 'disgust', 2: 'fear', 3: 'happy',
    4: 'sad',   5: 'surprise', 6: 'neutral'
}

TRAIN_ROOT = "data/video_datasets/train"
VAL_ROOT   = "data/video_datasets/val"
TMP_DIR    = "data/_tmp_downloads"     # local temp — avoids /tmp permission issues
FRAMES_PER_VIDEO = 25                  # frames to extract per MP4
VAL_ACTOR_EVERY  = 5                   # every 5th video goes to val (20% split)


# =====================================================================
# HELPERS
# =====================================================================

def _progress_hook(count, block_size, total_size):
    if total_size <= 0:
        print(f"\r  Downloading... {count * block_size / 1_000_000:.1f} MB", end='')
    else:
        pct  = min(count * block_size / total_size * 100, 100)
        done = count * block_size / 1_000_000
        tot  = total_size / 1_000_000
        bar  = '█' * int(pct // 5) + '░' * (20 - int(pct // 5))
        print(f"\r  [{bar}] {pct:5.1f}%  {done:.1f}/{tot:.1f} MB", end='', flush=True)


def safe_download(url, dest):
    """Downloads a file; returns True on success, False on failure."""
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        urllib.request.urlretrieve(url, dest, reporthook=_progress_hook)
        print()  # newline after progress bar
        return True
    except Exception as e:
        print(f"\n  ❌ Download failed: {e}")
        return False


def extract_frames_from_video(mp4_path, emotion, prefix, is_val=False):
    """
    Opens an MP4, samples `FRAMES_PER_VIDEO` evenly-spaced frames,
    converts to 48×48 grayscale JPEGs, and saves them to the correct split.
    """
    folder = os.path.join(VAL_ROOT if is_val else TRAIN_ROOT, emotion)
    os.makedirs(folder, exist_ok=True)

    cap = cv2.VideoCapture(str(mp4_path))
    if not cap.isOpened():
        return 0

    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    step  = max(1, total // FRAMES_PER_VIDEO)

    saved, frame_idx = 0, 0
    while saved < FRAMES_PER_VIDEO:
        ret, frame = cap.read()
        if not ret:
            break
        if frame_idx % step == 0:
            gray  = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray  = cv2.resize(gray, (48, 48))
            fname = f"{prefix}_frame_{saved:04d}.jpg"
            cv2.imwrite(os.path.join(folder, fname), gray)
            saved += 1
        frame_idx += 1

    cap.release()
    return saved


# =====================================================================
# RAVDESS — Download from Zenodo
# =====================================================================

def already_downloaded_actors():
    """Reads frame filenames to determine which RAVDESS actors already exist."""
    found = set()
    for split in [TRAIN_ROOT, VAL_ROOT]:
        for emo in emotion_labels:
            folder = os.path.join(split, emo)
            if not os.path.isdir(folder):
                continue
            for f in os.listdir(folder):
                m = re.match(r'actor(\d+)_', f)
                if m:
                    found.add(int(m.group(1)))
    return found


def download_ravdess(actors=None):
    """
    Downloads RAVDESS speech video ZIPs from Zenodo for the given actor numbers.
    Zenodo record 1188976 — completely public, no login required.
    """
    if actors is None:
        actors = list(range(1, 25))   # All 24 actors

    existing = already_downloaded_actors()
    to_fetch = [a for a in actors if a not in existing]

    if not to_fetch:
        print("  ✅ All target RAVDESS actors already present — skipping download.")
        return

    print(f"  ℹ️  Existing actors: {sorted(existing)}")
    print(f"  📥 Will download {len(to_fetch)} new actors: {to_fetch}")

    os.makedirs(TMP_DIR, exist_ok=True)

    for actor in to_fetch:
        zip_name = f"Video_Speech_Actor_{actor:02d}.zip"
        zip_url  = f"https://zenodo.org/record/1188976/files/{zip_name}?download=1"
        zip_path = os.path.join(TMP_DIR, zip_name)
        ext_path = os.path.join(TMP_DIR, f"actor_{actor:02d}")

        print(f"\n  ── Actor {actor:02d}/24 ──────────────────────────────")
        print(f"  URL: {zip_url}")

        if not safe_download(zip_url, zip_path):
            continue    # skip this actor on failure

        # Extract
        print(f"  📦 Extracting {zip_name}...")
        try:
            with zipfile.ZipFile(zip_path, 'r') as z:
                z.extractall(ext_path)
        except zipfile.BadZipFile as e:
            print(f"  ❌ Bad ZIP: {e}. Skipping actor {actor}.")
            os.remove(zip_path)
            continue

        # Process each MP4
        mp4s = list(Path(ext_path).rglob("*.mp4"))
        print(f"  🎬 Extracting frames from {len(mp4s)} videos...")

        for i, mp4 in enumerate(mp4s):
            parts = mp4.stem.split('-')
            if len(parts) < 3:
                continue
            emotion = RAVDESS_EMOTION_MAP.get(parts[2])
            if emotion not in emotion_labels:
                continue

            is_val = (i % VAL_ACTOR_EVERY == 0)
            prefix = f"actor{actor:02d}_{mp4.stem}"
            frames = extract_frames_from_video(mp4, emotion, prefix, is_val=is_val)

        # Cleanup downloaded files to save disk space
        os.remove(zip_path)
        shutil.rmtree(ext_path, ignore_errors=True)
        print(f"  ✅ Actor {actor:02d} complete!")

    # Clean up temp dir if empty
    if os.path.isdir(TMP_DIR) and not os.listdir(TMP_DIR):
        shutil.rmtree(TMP_DIR)


# =====================================================================
# FER2013 — Process CSV into frame images
# =====================================================================

def process_fer2013_csv(csv_path):
    """
    Reads FER2013.csv and saves each image as a 48×48 grayscale JPEG
    into the correct emotion folder.

    FER2013 CSV format:
        emotion,pixels,Usage
        0,"70 80 82 ...",Training
        ...

    Each image is saved with a unique name ending in _frame_0000.jpg
    so the training generator can build sequences from it by augmentation.
    """
    print(f"\n  Reading {csv_path}...")

    if not os.path.exists(csv_path):
        print(f"  ❌ File not found: {csv_path}")
        return

    train_counts = {e: 0 for e in emotion_labels}
    val_counts   = {e: 0 for e in emotion_labels}

    with open(csv_path, 'r', newline='') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    total = len(rows)
    print(f"  Found {total:,} images. Converting to JPEGs...")

    for i, row in enumerate(rows):
        if i % 2000 == 0:
            print(f"\r  {i:,}/{total:,} ({i/total*100:.0f}%)", end='', flush=True)

        emotion_idx = int(row['emotion'])
        emotion = FER_EMOTION_MAP.get(emotion_idx)
        if emotion is None:
            continue

        # Reconstruct 48×48 image from space-separated pixel string
        pixels = np.array(row['pixels'].split(), dtype=np.uint8).reshape(48, 48)
        usage  = row.get('Usage', 'Training')

        if usage == 'Training':
            folder  = os.path.join(TRAIN_ROOT, emotion)
            idx     = train_counts[emotion]
            train_counts[emotion] += 1
        else:
            folder  = os.path.join(VAL_ROOT, emotion)
            idx     = val_counts[emotion]
            val_counts[emotion] += 1

        os.makedirs(folder, exist_ok=True)
        fname = f"fer2013_{emotion}_{idx:05d}_frame_0000.jpg"
        cv2.imwrite(os.path.join(folder, fname), pixels)

    print(f"\r  {total:,}/{total:,} (100%)")
    print("\n  ✅ FER2013 processing complete!")

    print("\n  Train split counts:")
    for e in emotion_labels:
        print(f"    {e:10s}: {train_counts[e]:,} images")
    print("\n  Val split counts:")
    for e in emotion_labels:
        print(f"    {e:10s}: {val_counts[e]:,} images")


def fer2013_instructions():
    print("""
  ╔══════════════════════════════════════════════════════════════╗
  ║              HOW TO GET FER2013 (2 minutes, free)           ║
  ╠══════════════════════════════════════════════════════════════╣
  ║                                                              ║
  ║  1. Create a free Kaggle account → https://kaggle.com        ║
  ║  2. Go to: Kaggle → Profile → Account → API → Create Token  ║
  ║     This downloads  kaggle.json                              ║
  ║  3. Run in terminal:                                         ║
  ║       mkdir -p ~/.kaggle                                     ║
  ║       mv ~/Downloads/kaggle.json ~/.kaggle/                  ║
  ║       chmod 600 ~/.kaggle/kaggle.json                        ║
  ║  4. Install Kaggle CLI:                                      ║
  ║       pip3 install kaggle                                    ║
  ║  5. Download FER2013:                                        ║
  ║       kaggle datasets download msambare/fer2013 \\           ║
  ║              -p data/fer2013 --unzip                         ║
  ║  6. Re-run this script:                                      ║
  ║       python3 prepare_data.py                                ║
  ║                                                              ║
  ╚══════════════════════════════════════════════════════════════╝
    """)


def try_kaggle_download():
    """Tries to download FER2013 using the Kaggle CLI if credentials exist."""
    kaggle_json = os.path.expanduser("~/.kaggle/kaggle.json")
    if not os.path.exists(kaggle_json):
        return False

    try:
        import subprocess
        os.makedirs("data/fer2013", exist_ok=True)
        print("  🔑 Kaggle credentials found — downloading FER2013 automatically...")
        result = subprocess.run(
            ["kaggle", "datasets", "download", "msambare/fer2013",
             "-p", "data/fer2013", "--unzip"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            print("  ✅ FER2013 downloaded via Kaggle!")
            return True
        else:
            print(f"  ⚠️  Kaggle download failed: {result.stderr}")
            return False
    except FileNotFoundError:
        print("  ⚠️  kaggle CLI not installed. Run: pip3 install kaggle")
        return False


# =====================================================================
# DATASET SUMMARY
# =====================================================================

def print_summary():
    print("\n" + "=" * 60)
    print("📊 Final Dataset Summary")
    print("=" * 60)

    grand_total = 0
    for split, root in [("TRAIN", TRAIN_ROOT), ("VAL", VAL_ROOT)]:
        split_total = 0
        print(f"\n  {split}")
        for emo in emotion_labels:
            folder = os.path.join(root, emo)
            n = len([f for f in os.listdir(folder) if f.endswith('.jpg')]) \
                if os.path.isdir(folder) else 0
            print(f"    {emo:10s}:  {n:6,} frames")
            split_total += n
        print(f"    {'TOTAL':10s}:  {split_total:6,} frames")
        grand_total += split_total

    print(f"\n  GRAND TOTAL: {grand_total:,} frames")
    print("=" * 60)


# =====================================================================
# MAIN
# =====================================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="TruthLens Dataset Preparation")
    parser.add_argument('--skip-ravdess', action='store_true',
                        help='Skip RAVDESS download (use existing data only)')
    parser.add_argument('--skip-fer',    action='store_true',
                        help='Skip FER2013 processing')
    parser.add_argument('--fer-csv',     type=str, default=None,
                        help='Path to fer2013.csv if already downloaded')
    parser.add_argument('--actors',      type=str, default='1-24',
                        help='RAVDESS actor range e.g. 1-12 (default: 1-24)')
    args = parser.parse_args()

    print("=" * 60)
    print("🚀 TruthLens — Dataset Preparation")
    print("=" * 60)

    # ── Parse actor range ────────────────────────────────────────
    if '-' in args.actors:
        a_start, a_end = args.actors.split('-')
        actor_list = list(range(int(a_start), int(a_end) + 1))
    else:
        actor_list = [int(x) for x in args.actors.split(',')]

    # ── STEP 1: RAVDESS ───────────────────────────────────────────
    if not args.skip_ravdess:
        print(f"\n[1/2] 🎬 RAVDESS — Actors {actor_list[0]}-{actor_list[-1]} from Zenodo")
        print("      No login required — Zenodo is a public open-access repository\n")
        download_ravdess(actors=actor_list)
    else:
        print("\n[1/2] ⏭️  Skipping RAVDESS download (--skip-ravdess)")

    # ── STEP 2: FER2013 ───────────────────────────────────────────
    if not args.skip_fer:
        print("\n[2/2] 📷 FER2013 — 35,887 labeled facial expression images")

        # Priority: --fer-csv arg → pre-downloaded CSV → Kaggle CLI → instructions
        fer_csv_path = args.fer_csv or "data/fer2013/fer2013.csv"

        if os.path.exists(fer_csv_path):
            print(f"  ✅ Found CSV at {fer_csv_path}")
            process_fer2013_csv(fer_csv_path)
        else:
            downloaded = try_kaggle_download()
            if downloaded and os.path.exists("data/fer2013/fer2013.csv"):
                process_fer2013_csv("data/fer2013/fer2013.csv")
            else:
                print("  ❌ FER2013 not found locally and could not be auto-downloaded.")
                fer2013_instructions()
    else:
        print("\n[2/2] ⏭️  Skipping FER2013 (--skip-fer)")

    # ── SUMMARY ───────────────────────────────────────────────────
    print_summary()
    print("\n🎯 Next step — start training:")
    print("   /Library/Frameworks/Python.framework/Versions/3.11/bin/python3 train.py")
