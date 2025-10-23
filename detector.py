import cv2
import mediapipe as mp
import socketio
import threading
from flask import Flask

# --- Flask + Socket.IO セットアップ ---
app = Flask(__name__)
sio = socketio.Server(cors_allowed_origins="*", async_mode="threading")
flask_app = socketio.WSGIApp(sio, app)

@sio.event
def connect(sid, environ):
    print(f"✅ Client connected: {sid}")

def start_server():
    print("🌐 Starting Socket.IO server on http://localhost:9001 ...")
    from werkzeug.serving import run_simple
    run_simple("0.0.0.0", 9001, flask_app, use_reloader=False, threaded=True)

# --- サーバーをバックグラウンドで起動 ---
threading.Thread(target=start_server, daemon=True).start()

# --- MediaPipe初期化 ---
mp_hands = mp.solutions.hands
hands = mp_hands.Hands(
    max_num_hands=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.5
)
mp_draw = mp.solutions.drawing_utils

cap = cv2.VideoCapture(0)
print("🎥 MediaPipe Hand detector initialized.")

def emit_hand_data(dir, spread, shoot):
    """Socket.IOで非同期送信"""
    try:
        sio.emit("hand", {"dir": dir, "spread": spread, "shoot": shoot})
        print(f"→ SEND: dir={dir}, shoot={shoot}")
    except Exception as e:
        print("Emit error:", e)

# --- メインループ ---
while True:
    ret, frame = cap.read()
    if not ret:
        continue

    frame = cv2.flip(frame, 1)
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = hands.process(rgb)

    hand_dir = "CENTER"
    spread = 0.0
    shoot = False

    if result.multi_hand_landmarks:
        for hand_landmarks in result.multi_hand_landmarks:
            wrist = hand_landmarks.landmark[0]
            index = hand_landmarks.landmark[8]
            pinky = hand_landmarks.landmark[20]

            dx = index.x - wrist.x
            if dx > 0.05:
                hand_dir = "RIGHT"
            elif dx < -0.05:
                hand_dir = "LEFT"

            spread = abs(index.y - pinky.y)
            shoot = spread > 0.25  # パーなら発射ON

            mp_draw.draw_landmarks(frame, hand_landmarks, mp_hands.HAND_CONNECTIONS)

        # emitを別スレッドで投げる（MediaPipe処理と独立）
        threading.Thread(
            target=emit_hand_data, args=(hand_dir, spread, shoot), daemon=True
        ).start()

    cv2.imshow("Hand Tracking", frame)
    if cv2.waitKey(1) & 0xFF == 27:
        break

cap.release()
cv2.destroyAllWindows()
