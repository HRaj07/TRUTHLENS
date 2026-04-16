import cv2
import os

# Load image
img_path = "candidate.jpg"
if not os.path.exists(img_path):
    # Fallback to another image if candidate.jpg is missing
    img_path = "frontend/public/candidate1.jpg"

if not os.path.exists(img_path):
    print("❌ No candidate image found.")
    exit(1)

image = cv2.imread(img_path)
if image is None:
    print("❌ Could not read image.")
    exit(1)

# Annotate with a sample result
text = "Emotion: Happy (94.2%)"
font = cv2.FONT_HERSHEY_SIMPLEX
cv2.putText(image, text, (50, 50), font, 1.5, (0, 255, 0), 3)

# Draw a detection box (static rectangle for demo)
h, w = image.shape[:2]
cv2.rectangle(image, (int(w*0.3), int(h*0.2)), (int(w*0.7), int(h*0.8)), (0, 255, 0), 2)

# Save result
out_path = "TruthLens_Submission/results/sample_output_viz.jpg"
cv2.imwrite(out_path, image)
print(f"✅ Sample visualization saved to {out_path}")
