#!/usr/bin/env python3
"""
Concatenate all TruthLens voiceover segments into one final MP3.
"""
from moviepy.editor import concatenate_audioclips, AudioFileClip
import os

AUDIO_DIR = "/Users/harshit/Documents/StreamFab/TRUTHLENS/demo_audio"
OUTPUT    = "/Users/harshit/Documents/StreamFab/TRUTHLENS/demo_audio/FINAL_voiceover.mp3"

segments = [
    "01_intro.mp3",
    "02_what_it_does.mp3",
    "03_signup_intro.mp3",
    "04_login.mp3",
    "05_interviewer_dashboard.mp3",
    "06_share_code.mp3",
    "07_interview_room.mp3",
    "08_emotion_ai.mp3",
    "09_question_bar.mp3",
    "10_screen_sharing_chat.mp3",
    "11_candidate_view.mp3",
    "12_end_session_report.mp3",
    "13_outro.mp3",
]

print("🔗 Concatenating audio segments...")
clips = []
total = 0
for seg in segments:
    path = os.path.join(AUDIO_DIR, seg)
    clip = AudioFileClip(path)
    print(f"  ✅ {seg} — {clip.duration:.1f}s")
    total += clip.duration
    clips.append(clip)

final = concatenate_audioclips(clips)
final.write_audiofile(OUTPUT, fps=44100)
print(f"\n✅ Final voiceover saved: {OUTPUT}")
print(f"   Total duration: {total:.1f}s ({total/60:.1f} min)")
