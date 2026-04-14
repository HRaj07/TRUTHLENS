import cv2
import numpy as np
import math
import os

out_path = 'frontend/public/demo.webm'
width, height = 1280, 720
fps = 30
duration = 15 # 15s is enough for a seamless loop and saves time
frames = fps * duration

# Exact UX BGR Colors
bg_color = (23, 6, 2)       # slate-950
panel_color = (42, 23, 15)  # slate-900
border_color = (59, 41, 30) # slate-800
neon_color = (191, 212, 45) # neon-400 #2dd4bf -> BGR
cyber_color = (252, 132, 192) # cyber-400 #c084fc 
danger_color = (113, 113, 248) # danger-400 #f87171
text_color = (241, 245, 248) # slate-100
subtext_color = (148, 163, 184) # slate-400

font = cv2.FONT_HERSHEY_SIMPLEX

# Try to load candidate image
try:
    cand_img = cv2.imread('candidate.jpg')
    # resize and crop to 800 x 480
    c_h, c_w = cand_img.shape[:2]
    aspect_ratio = 800/480
    if c_w/c_h > aspect_ratio:
        # crop width
        new_w = int(c_h * aspect_ratio)
        cand_img = cand_img[:, (c_w-new_w)//2:(c_w+new_w)//2]
    else:
        # crop height
        new_h = int(c_w / aspect_ratio)
        cand_img = cand_img[(c_h-new_h)//2:(c_h+new_h)//2, :]
    cand_img = cv2.resize(cand_img, (800, 480))
except:
    cand_img = np.zeros((480, 800, 3), dtype=np.uint8)
    cand_img[:] = (30,30,30)

fourcc = cv2.VideoWriter_fourcc(*'vp08')
out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))
if not out.isOpened():
    out_path = 'frontend/public/demo.mp4'
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

def draw_rounded_rect(img, pt1, pt2, color, thickness, r):
    x1, y1 = pt1
    x2, y2 = pt2
    cv2.line(img, (x1+r, y1), (x2-r, y1), color, thickness)
    cv2.line(img, (x1+r, y2), (x2-r, y2), color, thickness)
    cv2.line(img, (x1, y1+r), (x1, y2-r), color, thickness)
    cv2.line(img, (x2, y1+r), (x2, y2-r), color, thickness)
    cv2.ellipse(img, (x1+r, y1+r), (r, r), 180, 0, 90, color, thickness)
    cv2.ellipse(img, (x2-r, y1+r), (r, r), 270, 0, 90, color, thickness)
    cv2.ellipse(img, (x2-r, y2-r), (r, r), 0, 0, 90, color, thickness)
    cv2.ellipse(img, (x1+r, y2-r), (r, r), 90, 0, 90, color, thickness)

for i in range(frames):
    img = np.zeros((height, width, 3), dtype=np.uint8)
    img[:] = bg_color
    t = i / fps
    
    # ── Top Bar ──
    cv2.rectangle(img, (0,0), (width, 64), panel_color, -1)
    cv2.line(img, (0, 64), (width, 64), border_color, 1)
    
    cv2.putText(img, "TRUTH", (24, 40), cv2.FONT_HERSHEY_DUPLEX, 0.8, text_color, 2, cv2.LINE_AA)
    cv2.putText(img, "LENS", (120, 40), cv2.FONT_HERSHEY_DUPLEX, 0.8, neon_color, 2, cv2.LINE_AA)
    
    cv2.putText(img, "SESSION: OHO1SD", (400, 40), font, 0.5, subtext_color, 1, cv2.LINE_AA)
    time_str = f"{int(12+t//60):02d}:{int(34+t)%60:02d}"
    cv2.putText(img, time_str, (560, 40), font, 0.5, neon_color, 1, cv2.LINE_AA)
    
    cv2.rectangle(img, (1100, 16), (1250, 48), danger_color, -1)
    cv2.putText(img, "END SESSION", (1120, 36), font, 0.5, (0,0,0), 2, cv2.LINE_AA)

    # ── Left Pane (Video) ──
    video_rect = (24, 88, 800, 480) # x, y, w, h
    img[88:88+480, 24:24+800] = cand_img
    
    # Video Overlay - Face Tracking
    bx, by, bw, bh = 320, 100, 200, 240
    # Breathing box
    boxy = int(10 * math.sin(t * 3))
    cv2.rectangle(img, (24+bx-10, 88+by-10+boxy), (24+bx+bw+10, 88+by+bh+10+boxy), neon_color, 1)
    
    # Face mapping mesh points
    for py in range(4):
        for px in range(4):
            dx = 24+bx + px*(bw//3) + int(5*math.sin(t*2+py))
            dy = 88+by + py*(bh//3) + boxy + int(5*math.cos(t*3+px))
            cv2.circle(img, (dx, dy), 2, neon_color, -1)

    # Watermark / overlay text
    cv2.putText(img, "CANDIDATE: EMILY CHEN", (40, 110), font, 0.4, (255,255,255), 1, cv2.LINE_AA)
    cv2.putText(img, "ANALYZING MICRO-EXPRESSIONS...", (40, 130), font, 0.4, neon_color, 1, cv2.LINE_AA)

    draw_rounded_rect(img, (24, 88), (824, 568), border_color, 2, 10)

    # ── Left Bottom (Prompt) ──
    cv2.rectangle(img, (24, 584), (824, 690), panel_color, -1)
    draw_rounded_rect(img, (24, 584), (824, 690), border_color, 1, 10)
    cv2.putText(img, "ACTIVE BEHAVIORAL PROMPT", (48, 620), font, 0.4, neon_color, 1, cv2.LINE_AA)
    cv2.putText(img, "Tell me about a time you had to deliver", (48, 650), font, 0.8, text_color, 2, cv2.LINE_AA)
    cv2.putText(img, "critical feedback to a senior colleague.", (48, 680), font, 0.8, text_color, 2, cv2.LINE_AA)

    # ── Right Pane (Neural Feed) ──
    rx = 850
    cv2.putText(img, "NEURAL FEED", (rx, 110), font, 0.5, text_color, 2, cv2.LINE_AA)
    
    # 4 Metric Boxes
    metrics = [
        ("TruthScore", 98.4 + math.sin(t)*0.5, neon_color),
        ("Stress Level", 12.3 + math.cos(t*2)*2.0, danger_color),
        ("Confidence", 94.1 + math.sin(t*1.5)*1.2, cyber_color),
        ("Consistency", 96.0 + math.cos(t*0.5)*0.8, neon_color),
    ]
    
    bx_w = 180
    bx_h = 100
    for j, (m_id, (label, val, color)) in enumerate(zip(range(4), metrics)):
        c_i = m_id % 2
        r_i = m_id // 2
        px1 = rx + c_i * (bx_w + 16)
        py1 = 140 + r_i * (bx_h + 16)
        
        cv2.rectangle(img, (px1, py1), (px1+bx_w, py1+bx_h), panel_color, -1)
        draw_rounded_rect(img, (px1, py1), (px1+bx_w, py1+bx_h), border_color, 1, 8)
        
        # Border top highlight
        cv2.line(img, (px1+10, py1), (px1+bx_w-10, py1), color, 2)
        
        cv2.putText(img, label.upper(), (px1+16, py1+30), font, 0.4, subtext_color, 1, cv2.LINE_AA)
        cv2.putText(img, f"{val:.1f}%", (px1+16, py1+70), font, 1.0, text_color, 2, cv2.LINE_AA)
        
        # progress bar mini
        cv2.line(img, (px1+16, py1+85), (px1+bx_w-16, py1+85), border_color, 4)
        bar_len = int((bx_w-32) * (val/100))
        cv2.line(img, (px1+16, py1+85), (px1+16+bar_len, py1+85), color, 4)

    # ── Trend Chart ──
    cy_chart = 420
    cv2.putText(img, "CONFIDENCE TREND (60S)", (rx, str(cy_chart) and 400), font, 0.4, subtext_color, 1, cv2.LINE_AA)
    ch_w, ch_h = 376, 120
    cv2.rectangle(img, (rx, cy_chart), (rx+ch_w, cy_chart+ch_h), panel_color, -1)
    
    # draw chart lines
    pts = []
    for x in range(ch_w):
        val = math.sin((x + t*50)*0.05) * 20 + math.cos((x - t*80)*0.02) * 10
        y = cy_chart + ch_h//2 - int(val)
        pts.append((rx+x, y))
        if len(pts) > 1:
            cv2.line(img, pts[-2], pts[-1], neon_color, 2, cv2.LINE_AA)

    # ── Sentiment Radar Graph ──
    ry = 610
    rad_cx, rad_cy = rx + ch_w//2, ry + 40
    cv2.putText(img, "SENTIMENT DISTRIBUTION", (rx, ry-20), font, 0.4, subtext_color, 1, cv2.LINE_AA)
    
    # 5 axes
    rad_r = 50
    poly_pts = []
    for p_id in range(5):
        angle = math.radians(p_id * 72 - 90)
        endx = int(rad_cx + rad_r * math.cos(angle))
        endy = int(rad_cy + rad_r * math.sin(angle))
        cv2.line(img, (rad_cx, rad_cy), (endx, endy), border_color, 1, cv2.LINE_AA)
        
        # Random pulsing data point
        val = 0.4 + 0.6 * abs(math.sin(t*2 + p_id*1.5))
        if p_id == 0: val = 0.9 # Dominant
        dx = int(rad_cx + rad_r * val * math.cos(angle))
        dy = int(rad_cy + rad_r * val * math.sin(angle))
        poly_pts.append((dx, dy))
        
    pts_arr = np.array(poly_pts, np.int32).reshape((-1, 1, 2))
    # Filled polygon with cyber color but hacky alpha (OpenCV no native alpha fill easily, we just draw lines)
    cv2.polylines(img, [pts_arr], True, cyber_color, 2, cv2.LINE_AA)

    out.write(img)

out.release()
print("High-quality product simulation video generated.")
