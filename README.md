# Gestura
An interactive web-based **shooting game** powered by **MediaPipe**, **OpenCV**, and **p5.js**.  
Players control the ship using **hand gestures** — no keyboard or mouse required.  
This project was originally built for **exhibition and festival demonstrations** where visitors can play without touching any device.

---

## 🚀 Overview

- **Camera-based gameplay** using MediaPipe hand tracking  
- Real-time connection between **Python (backend)** and **p5.js (frontend)** via **Socket.IO**
- **Demo mode** activates automatically when no player is detected  
- **Game starts** after 4 seconds of continuous hand detection  
- **Game ends** after 30 seconds or 10 seconds of hand loss  
- **Automatic restart** to demo mode — fully unattended operation  
- Compatible with both **built-in** and **external USB webcams**

---

## 🧩 Confirmed Environment

This project has been tested under the following environment:

| Component | Version / Hardware |
|------------|--------------------|
| OS | Ubuntu 22.04 LTS (also tested on Windows 11) |
| Python | 3.10.12 |
| OpenCV | 4.10+ |
| MediaPipe | 0.10+ |
| Flask | 3.0+ |
| python-socketio | 5.11+ |
| Hardware | Lenovo ThinkPad E14 Gen5 (Ryzen 5 7530U) |
| Camera | Integrated 720p & External USB HD Camera |

💡 *Works on Windows, macOS, or most modern Linux distributions.*

---

## ⚙️ Dependencies

You’ll need the following Python packages:

```bash
pip install opencv-python mediapipe flask python-socketio Werkzeug numpy

-## ⚙️ Dependencies

---