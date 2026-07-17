#!/usr/bin/env python3
"""
TruthLens Demo Voiceover Generator
Generates a professional AI voiceover script as audio segments.
"""
from gtts import gTTS
import os

OUTPUT_DIR = "/Users/harshit/Documents/StreamFab/TRUTHLENS/demo_audio"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Each segment: (filename, text)
segments = [
    ("01_intro", """
        Introducing TruthLens — the next-generation AI-powered technical interview platform.
        In a world where hiring decisions carry enormous weight, TruthLens gives interviewers 
        an unprecedented edge: real-time behavioral intelligence, powered by deep learning.
    """),

    ("02_what_it_does", """
        Here's how it works. TruthLens runs a live WebRTC video interview between an interviewer 
        and a candidate. While the conversation unfolds, our custom CNN-LSTM model silently analyzes 
        the candidate's facial expressions in real time — tracking confidence, stress, and emotional 
        state, frame by frame.
        
        The result? Objective, data-driven insights that help you make smarter hiring decisions — 
        without any bias.
    """),

    ("03_signup_intro", """
        Let's see it in action. First, head to TruthLens and create your account. 
        You can sign up as an Interviewer — to conduct sessions — or as a Candidate — to join them.
        Just enter your name, email, and password, select your role, and you're in.
    """),

    ("04_login", """
        Already have an account? Simply sign in. Select your role — Interviewer or Candidate — 
        enter your credentials, and click Sign In. TruthLens will take you straight to your dashboard.
    """),

    ("05_interviewer_dashboard", """
        This is the Interviewer Dashboard. Here you can see all your past and scheduled sessions, 
        track candidate performance over time, and start a brand new interview in one click.
        
        Let's create a new session. Hit "New Session", and TruthLens instantly generates 
        a unique session code for you.
    """),

    ("06_share_code", """
        Share this session code with your candidate. They can enter it on their Candidate Dashboard 
        to join the room. The code is short, easy to share, and expires when the session ends.
        
        Once the candidate connects, the interview begins automatically.
    """),

    ("07_interview_room", """
        Welcome to the Interview Room. On the left, you see the main video feed — 
        your candidate's live camera. In the bottom right corner, your own video appears 
        as a picture-in-picture, just like a real video call.
        
        At the top, you can see the session timer, the secure connection status, 
        and quick controls for the session.
    """),

    ("08_emotion_ai", """
        Now here's where TruthLens gets powerful. On the right side, the Neural Feed panel 
        shows live AI analysis — updating every 3 seconds.
        
        You get the TruthScore, stress level, confidence rating, and consistency — 
        all calculated in real time from the candidate's facial expressions.
        
        Below that, a live confidence trend graph shows how the candidate is performing 
        over the last 60 seconds. And the sentiment radar gives you a full breakdown 
        of the emotional distribution throughout the call.
    """),

    ("09_question_bar", """
        At the bottom of the video area, there's the Active Behavioral Prompt bar. 
        TruthLens automatically surfaces structured interview questions — from "Tell me about yourself" 
        to deeper behavioral prompts.
        
        As an interviewer, you control the pace. Hit the arrow to move to the next question 
        whenever you're ready.
    """),

    ("10_screen_sharing_chat", """
        Need to share a coding problem or design doc? Hit the screen share button on the control bar 
        to share your screen instantly — no plugins or extensions needed.
        
        The chat panel lets you exchange messages, share links, or send code snippets 
        during the interview — all within the same window, with no distractions.
    """),

    ("11_candidate_view", """
        Now let's look at the Candidate experience. The candidate receives the session code 
        from the interviewer, pastes it into their Candidate Dashboard, and joins the room.
        
        Their view is clean and focused — they see the interviewer's video, the active behavioral prompt, 
        and the control bar. No distracting analytics, no pressure — just a natural conversation.
    """),

    ("12_end_session_report", """
        When the interview is complete, the interviewer clicks End Session. 
        TruthLens automatically compiles a full analytics report — showing the emotional timeline, 
        dominant sentiment, stress impact, confidence score, and a frame-by-frame breakdown 
        of the entire session.
        
        You can download the full report as a PDF, or share a link directly with your hiring team.
    """),

    ("13_outro", """
        TruthLens brings objectivity, speed, and intelligence to every interview — 
        turning gut feeling into data-backed decisions.
        
        Built with React, WebRTC, FastAPI, MongoDB, and a custom CNN-LSTM deep learning model, 
        TruthLens is ready to scale.
        
        This is TruthLens. The future of hiring is here.
    """),
]

print("🎙️  Generating AI voiceover segments...")
for filename, text in segments:
    path = os.path.join(OUTPUT_DIR, f"{filename}.mp3")
    tts = gTTS(text=text.strip(), lang='en', tld='com', slow=False)
    tts.save(path)
    print(f"  ✅ Saved: {filename}.mp3")

print(f"\n✅ All {len(segments)} segments generated in: {OUTPUT_DIR}")
print("\nSegment list:")
for i, (name, _) in enumerate(segments, 1):
    print(f"  {i:02d}. {name}.mp3")
