import cv2
import numpy as np
import os
import math

out_path = 'frontend/public/demo.webm'
width, height = 1280, 720
fps = 30
duration = 30
frames = fps * duration

# Try vp08 (WebM)
fourcc = cv2.VideoWriter_fourcc(*'vp08')
out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

if not out.isOpened():
    print("VP08 failed, falling back to mp4v")
    out_path = 'frontend/public/demo.mp4'
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(out_path, fourcc, fps, (width, height))

for i in range(frames):
    img = np.zeros((height, width, 3), dtype=np.uint8)
    
    # BGR for slate-950 (rgb 2, 6, 23) -> BGR(23, 6, 2)
    img[:] = (30, 15, 10)
    
    time_s = i / fps
    cx, cy = int(width/2), int(height/2)
    
    # 1. Draw central AI Core (Pulsing)
    core_radius = int(50 + math.sin(time_s * 4) * 10)
    # Draw glowing circles
    for r in range(core_radius, core_radius + 30, 5):
        alpha = max(0, 1.0 - (r - core_radius)/30.0)
        color = (int(255*alpha), int(255*alpha), int(0)) # Cyan-ish in BGR is (255, 255, 0)
        cv2.circle(img, (cx, cy), r, color, 2)
        
    # 2. Draw orbital rings
    cv2.ellipse(img, (cx, cy), (300, 100), time_s * 20, 0, 360, (150, 50, 50), 2)
    cv2.ellipse(img, (cx, cy), (100, 300), -time_s * 15, 0, 360, (50, 150, 50), 2)
    
    # 3. Draw scanning radar
    radar_radius = 250
    cv2.circle(img, (cx, cy), radar_radius, (50, 200, 50), 1)
    sweep_angle = (time_s * 60) % 360
    sweep_x = int(cx + radar_radius * math.cos(math.radians(sweep_angle)))
    sweep_y = int(cy + radar_radius * math.sin(math.radians(sweep_angle)))
    cv2.line(img, (cx, cy), (sweep_x, sweep_y), (100, 255, 100), 2)
    
    # 4. Animated Data Blocks
    font = cv2.FONT_HERSHEY_SIMPLEX
    cv2.putText(img, 'TRUTHLENS NEURAL ENGINE', (40, 60), font, 1.2, (255, 255, 255), 3, cv2.LINE_AA)
    cv2.putText(img, f'SYSTEM TIME: {time_s:.2f}s', (40, 110), font, 0.8, (0, 200, 200), 2, cv2.LINE_AA)
    
    # Simulation metrics
    truth_score = 95.0 + math.sin(time_s * 2) * 4.0
    stress_level = 15.0 + math.cos(time_s * 3) * 5.0
    
    cv2.putText(img, f'TRUTH SCORE:   {truth_score:.1f}%', (40, height - 120), font, 0.9, (200, 200, 0), 2)
    cv2.putText(img, f'STRESS LEVEL:  {stress_level:.1f}%', (40, height - 70), font, 0.9, (0, 200, 0) if stress_level < 18 else (0, 0, 255), 2)
    
    # Micro-expression matrix
    cv2.putText(img, 'MICRO-EXPRESSION MATRIX', (width - 400, 60), font, 0.7, (200, 200, 200), 1)
    for row in range(5):
        val = int(abs(math.sin(time_s * 5 + row)) * 100)
        color = (0, 255, int(val * 2.5))
        cv2.rectangle(img, (width - 400, 90 + row*30), (width - 400 + val*2, 110 + row*30), color, -1)
        cv2.putText(img, f'VAR {row}: {val}%', (width - 150, 105 + row*30), font, 0.5, (255, 255, 255), 1)
        
    out.write(img)

out.release()
print(f"Generated {out_path}")
