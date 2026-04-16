import os
import urllib.request
import zipfile
import cv2

# Maps RAVDESS emotion id to TruthLens emotion string
RAVDESS_EMOTION_MAP = {
    '01': 'neutral',
    '02': 'neutral',    # Combine calm and neutral
    '03': 'happy',
    '04': 'sad',
    '05': 'angry',
    '06': 'fear',
    '07': 'disgust',
    '08': 'surprise'
}

DATASET_ROOT = "data/video_datasets"
TRAIN_DIR = os.path.join(DATASET_ROOT, "train")
VAL_DIR = os.path.join(DATASET_ROOT, "val")
ZIP_URL = "https://zenodo.org/records/1188976/files/Video_Speech_Actor_01.zip"
ZIP_PATH = "Actor_01.zip"
EXTRACT_DIR = "temp_ravdess"

def setup_directories():
    for emotion in set(RAVDESS_EMOTION_MAP.values()):
        os.makedirs(os.path.join(TRAIN_DIR, emotion), exist_ok=True)
        os.makedirs(os.path.join(VAL_DIR, emotion), exist_ok=True)

def download_data():
    print("📥 Downloading RAVDESS Actor 01 sample (approx 160MB)...")
    urllib.request.urlretrieve(ZIP_URL, ZIP_PATH)
    print("✅ Download complete.")

def extract_data():
    print("📦 Extracting ZIP...")
    with zipfile.ZipFile(ZIP_PATH, 'r') as zip_ref:
        zip_ref.extractall(EXTRACT_DIR)
    print("✅ Extraction complete.")

def process_videos():
    print("🎥 Processing video frames into dataset folders...")
    actor_dir = os.path.join(EXTRACT_DIR, "Actor_01")
    
    if not os.path.exists(actor_dir):
        print("❌ Could not find expected Actor_01 directory.")
        return

    # To create a validation set, we'll put every 5th video into validation
    vid_count = 0
    for filename in os.listdir(actor_dir):
        if not filename.endswith(".mp4"): continue
        
        # RAVDESS format: modality-vocal_channel-emotion-intensity-statement-repetition-actor.mp4
        parts = filename.split('-')
        if len(parts) < 3: continue
        
        emotion_id = parts[2]
        emotion_label = RAVDESS_EMOTION_MAP.get(emotion_id)
        if not emotion_label: continue
        
        target_split = VAL_DIR if vid_count % 5 == 0 else TRAIN_DIR
        out_folder = os.path.join(target_split, emotion_label)
        
        vid_path = os.path.join(actor_dir, filename)
        cap = cv2.VideoCapture(vid_path)
        
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: break
            
            # Save frame
            vid_id = filename.replace(".mp4", "")
            out_filename = f"{vid_id}_frame_{frame_idx:04d}.jpg"
            cv2.imwrite(os.path.join(out_folder, out_filename), frame)
            frame_idx += 1
            
        cap.release()
        vid_count += 1
        
    print(f"✅ Processed {vid_count} videos into separate frame sequences.")

def cleanup():
    print("🧹 Cleaning up temporary files...")
    os.remove(ZIP_PATH)
    import shutil
    shutil.rmtree(EXTRACT_DIR)

if __name__ == "__main__":
    print("🚀 Auto-Downloading RAVDESS Dataset Sample into Generator Structure")
    try:
        setup_directories()
        download_data()
        extract_data()
        process_videos()
        cleanup()
        print("\n🎉 All frames downloaded, extracted, and placed perfectly for train.py!")
    except Exception as e:
        print(f"\n❌ Error during dataset setup: {e}")
