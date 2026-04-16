import base64
import cv2
import numpy as np

# A real tiny transparent PNG base64
b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAXNSR0IArs4c6QAAAAtJREFUGFdjYAACAAAFAAGq1QzQAAAAAElFTkSuQmCC"

encoded_data = b64.split(',')[1] if ',' in b64 else b64
# add padding
padding_needed = len(encoded_data) % 4
if padding_needed:
    encoded_data += '=' * (4 - padding_needed)

try:
    nparr = np.frombuffer(base64.b64decode(encoded_data), np.uint8)
    img_to_verify = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    print("Shape:", img_to_verify.shape if img_to_verify is not None else "None")
except Exception as e:
    print("Error:", e)
