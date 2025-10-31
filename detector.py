import base64
import cv2
import mediapipe as mp
import socketio
import threading
from flask import Flask
from collections import deque
import numpy as np
import time

# Flask + Socket.IO
app = Flask(__name__)
sio = socketio.Server(cors_allowed_origins="*", async_mode="threading")
flask_app = socketio.WSGIApp(sio, app)

@sio.event
def connect(sid, environ):
    print(f"✅ Client connected: {sid}")
    pass

def start_server():
    print("🌐 Starting Socket.IO server on http://localhost:9001 ...")
    from werkzeug.serving import run_simple
    run_simple("0.0.0.0", 9001, flask_app, use_reloader=False, threaded=True)

threading.Thread(target=start_server, daemon=True).start()

# MediaPipe
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(max_num_hands=2, min_detection_confidence=0.6, min_tracking_confidence=0.5)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)
# set to 2 when use webcam 

cap.set(cv2.CAP_PROP_FRAME_WIDTH, 648)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 640)
print("🎥 MediaPipe Hand detector initialized.")

dir_history = deque(maxlen=5)
shoot_history = deque(maxlen=5)
font = cv2.FONT_HERSHEY_SIMPLEX

TARGET_HAND = "Both"
PREVIEW_SIZE = (320, 240)
JPEG_QUALITY = 60
DISPLAY_PREVIEW_WINDOW = False

def encode_frame(frame):
    try:
        preview = cv2.resize(frame, PREVIEW_SIZE)
        success, buffer = cv2.imencode(
            ".jpg", preview, [int(cv2.IMWRITE_JPEG_QUALITY), JPEG_QUALITY]
        )
        if not success:
            return None
        return base64.b64encode(buffer).decode("utf-8")
    except Exception:
        return None

def emit_hand_data(dir, shoot, spread, frame_b64):
    payload = {"dir": dir, "shoot": shoot, "spread": spread}
    if frame_b64:
        payload["frame"] = frame_b64
    try:
        sio.emit("hand", payload)
        # print(f"→ SEND: dir={dir}, shoot={shoot}")
    except Exception as e:
        # print("Emit error:", e)
        pass

prev_time = 0
   
while True:
    ret, frame = cap.read()
    if not ret:
        continue

    frame = cv2.flip(frame, 1)               
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    hand_dir = "CENTER"
    shoot = False
    spread = 0.0
    no_hand = True

    if result.multi_hand_landmarks:
        for hand_landmarks, handedness in zip(result.multi_hand_landmarks, result.multi_handedness):
            label = handedness.classification[0].label  # "Left" / "Right"
            if TARGET_HAND != "Both" and label != TARGET_HAND:
                continue

            no_hand = False
        
            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

            wrist = hand_landmarks.landmark[0]
            index_finger = hand_landmarks.landmark[8]

            dx = index_finger.x - wrist.x
            if dx > 0.05:
                hand_dir = "RIGHT"
            elif dx < -0.05:
                hand_dir = "LEFT"
            else:
                hand_dir = "CENTER"

            finger_ids = [8, 12, 16, 20]
            extended = 0
            
            for fid in finger_ids:
                tip = hand_landmarks.landmark[fid]
                pip = hand_landmarks.landmark[fid - 2]
                mcp = hand_landmarks.landmark[fid - 3]

                if (tip.y < pip.y - 0.015):
                    extended += 1

                    
                shoot = extended >= 1
                
                if extended == 0:
                    shoot = False  
          
            spread = np.mean([abs(hand_landmarks.landmark[i].y - wrist.y) for i in finger_ids])

        dir_history.append(hand_dir)
        shoot_history.append(shoot)
        stable_dir = max(set(dir_history), key=dir_history.count)
        stable_shoot = bool(np.mean(shoot_history) > 0.3)

    else:
        stable_dir = "NO HAND"
        stable_shoot = False
        spread = 0.0

    frame_b64 = encode_frame(frame)

    threading.Thread(
        target=emit_hand_data,
        args=(stable_dir, stable_shoot, float(spread), frame_b64),
        daemon=True,
    ).start()

    if no_hand:
        lines = [
            "HAND:   NO HAND",
            "DIR:    NO HAND",
            "SHOOT:  False",
            "SPREAD: 0.000"
        ]
    else:
        lines = [
            f"HAND:   {TARGET_HAND}",
            f"DIR:    {stable_dir}",
            f"SHOOT:  {stable_shoot}",
            f"SPREAD: {spread:.3f}"
        ]

    y = 30
    for line in lines:
        cv2.putText(frame, line, (20, y), font, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        y += 25

    curr_time = time.time()
    fps = 1 / (curr_time - prev_time) if prev_time != 0 else 0
    prev_time = curr_time

    # === FPS描画 ===
    cv2.putText(frame, f"FPS: {int(fps)}", (20, 135), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

    if DISPLAY_PREVIEW_WINDOW:
        cv2.imshow("Hand Tracking Terminal", frame)
        if cv2.waitKey(1) & 0xFF == 27:
            break

cap.release()
cv2.destroyAllWindows()
