<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally, including a **real-time plastic detection system using AI**.

View your app in AI Studio: https://ai.studio/apps/dfb3c011-2679-457f-9901-7d011e312aad

## 🆕 Plastic Detection AI - New Feature!

**Point your phone camera at plastics and detect them in real-time using AI!**

- 🎥 Real-time camera feed
- 🤖 AI plastic detection (client-side)
- 📱 Works on any smartphone
- 🔒 100% private - no data sent anywhere
- ⚡ Fast - runs locally on your phone
- 📊 See confidence scores and FPS

**Quick Start:**
```bash
npm install && npm run dev:all
# Open: http://localhost:3000 on phone
# Go to "Plastic AI" tab
# Start detecting!
```

👉 **See [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) for complete overview**

## Run Locally

**Prerequisites:** Node.js

### Option 1: Frontend Only
```bash
npm install
npm run dev
# Open: http://localhost:3000
```

### Option 2: Frontend + Backend (Recommended)
```bash
npm install
npm run dev:all
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
```

### Option 3: Set up with Python (For AI Training)
```bash
npm install
pip install -r requirements.txt
npm run dev:all
```

## 🤖 Using Plastic Detection

### On Your Phone:
1. Open: `http://your-computer-ip:3000`
2. Go to "Plastic AI" tab
3. Tap "Start Detection"
4. Point at plastics!

### Train Custom Model:
```bash
pip install -r requirements.txt
python train_plastic_model.py --epochs 50
```

## 📚 Documentation

- **[FINAL_SUMMARY.md](./FINAL_SUMMARY.md)** - Complete overview (START HERE!)
- **[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)** - Commands cheat sheet
- **[PLASTIC_DETECTION_SETUP.md](./PLASTIC_DETECTION_SETUP.md)** - Detailed setup guide
- **[BACKEND_README.md](./BACKEND_README.md)** - Features & API
- **[IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md)** - How to use
- **[IMPLEMENTATION_CHECKLIST.md](./IMPLEMENTATION_CHECKLIST.md)** - What's been built
