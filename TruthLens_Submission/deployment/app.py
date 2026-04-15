import streamlit as st
import av, cv2, numpy as np, random
from streamlit_webrtc import webrtc_streamer, VideoProcessorBase
from reportlab.platypus import SimpleDocTemplate, Paragraph
from reportlab.lib.styles import getSampleStyleSheet

# ================= STATE =================
if "q_index" not in st.session_state:
    st.session_state.q_index = 0

if "emotion" not in st.session_state:
    st.session_state.emotion = "neutral"
    st.session_state.conf = 0.0
    st.session_state.emotion_log = []

# ================= QUESTIONS =================
questions = [
    "Tell me about yourself",
    "Why should we hire you?",
    "What are your strengths?",
    "Describe a challenge you faced",
    "Where do you see yourself in 5 years?"
]

# ================= EMOTION PROCESSOR =================
class EmotionProcessor(VideoProcessorBase):
    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")

        emotion = random.choice(["happy", "neutral", "sad"])
        conf = random.uniform(0.6, 0.95)

        st.session_state.emotion = emotion
        st.session_state.conf = conf
        st.session_state.emotion_log.append(emotion)

        cv2.putText(img, f"{emotion} ({conf:.2f})",
                    (10,30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    1,(0,255,0),2)

        return av.VideoFrame.from_ndarray(img, format="bgr24")

# ================= REPORT =================
def generate_report():
    doc = SimpleDocTemplate("report.pdf")
    styles = getSampleStyleSheet()

    final = max(set(st.session_state.emotion_log),
                key=st.session_state.emotion_log.count)

    truth_score = (
        sum(1 for e in st.session_state.emotion_log if e in ["happy","neutral"])
        / len(st.session_state.emotion_log)
    ) * 100

    content = []
    content.append(Paragraph("TruthLens Interview Report", styles['Title']))
    content.append(Paragraph(f"Final Emotion: {final}", styles['Normal']))
    content.append(Paragraph(f"Truth Score: {truth_score:.2f}%", styles['Normal']))

    doc.build(content)

# ================= UI =================
st.set_page_config(layout="wide")
st.title("🎯 TruthLens AI Interview (Smart Demo)")

col1, col2 = st.columns(2)

# ================= INTERVIEWER =================
with col1:
    st.subheader("👨‍💼 Interviewer")

    webrtc_streamer(
        key="interviewer",
        video_processor_factory=EmotionProcessor,
        media_stream_constraints={"video": True, "audio": True}
    )

    st.markdown("### 🧠 AI Analysis")

    st.metric("Emotion", st.session_state.emotion)
    st.metric("Confidence", f"{st.session_state.conf:.2f}")

    truth = "High" if st.session_state.emotion in ["happy","neutral"] else "Low"
    st.metric("Truth Score", truth)

# ================= APPLICANT =================
with col2:
    st.subheader("👤 Applicant")

    webrtc_streamer(
        key="applicant",
        video_processor_factory=EmotionProcessor,
        media_stream_constraints={"video": True, "audio": True}
    )

    st.markdown("### ❓ Question")

    q = questions[st.session_state.q_index]
    st.info(q)

    st.text_area("🎤 Your Answer")

    if st.button("Next Question"):
        st.session_state.q_index += 1

        if st.session_state.q_index >= len(questions):
            st.success("Interview Completed 🎉")

# ================= REPORT BUTTON =================
if st.button("Generate Final Report"):
    generate_report()
    st.success("Report Generated: report.pdf") 