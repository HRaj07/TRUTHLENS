import requests

url = "http://127.0.0.1:8000/api/auth/face-signup"
payload = {
    "name": "Test User",
    "email": "localtest4@example.com",
    "role": "candidate",
    "image": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    "company": ""
}
try:
    res = requests.post(url, json=payload)
    print("Signup Status:", res.status_code)
    print("Signup Response:", res.text)
except Exception as e:
    print("Error:", e)
