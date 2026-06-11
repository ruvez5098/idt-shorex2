# 📋 Quick Reference Card

## 🚀 Get Started in 30 Seconds

### Terminal 1: Frontend
```bash
npm install
npm run dev
```
Open: http://localhost:3000

### Terminal 2: Backend
```bash
npm run server
```
Open: http://localhost:5000

### Or Both Together
```bash
npm run dev:all
```

---

## 📱 Use on Phone

1. Get your computer's IP:
   - **Mac/Linux**: `ifconfig | grep inet`
   - **Windows**: `ipconfig`

2. On phone browser, go to:
   ```
   http://YOUR_IP:3000
   ```

3. Tap "Plastic AI" tab at bottom

4. Tap "Start Detection"

5. Allow camera

6. Point at plastic! 🎯

---

## 🤖 Train AI Model

### Requirements
```bash
pip install -r requirements.txt
```

### Train
```bash
python train_plastic_model.py --epochs 50
```

### Or With Custom Data
```bash
python train_plastic_model.py --data-dir ./my_dataset --epochs 100
```

---

## 📁 Key Files

| File | Purpose |
|------|---------|
| `src/PlasticDetector.tsx` | Camera UI |
| `src/plasticDetection.ts` | AI Model |
| `server.ts` | Backend API |
| `train_plastic_model.py` | Training |
| `public/models/` | Model files |

---

## 🔧 Common Commands

```bash
npm run dev              # Frontend only
npm run server           # Backend only
npm run dev:all          # Both
npm run build            # Production build
npm run lint             # Type check

python train_plastic_model.py                    # Train
python train_plastic_model.py --epochs 100      # More training
```

---

## 🌐 URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 | React app |
| Backend | http://localhost:5000 | Express server |
| Health | http://localhost:5000/api/health | Server status |

---

## 📱 Ports

- **Frontend**: 3000
- **Backend**: 5000
- **Model**: Served from /models/ directory

---

## 🐛 Troubleshooting

### "Camera not working"
```
→ Check browser permissions
→ Try incognito mode
→ Check console (F12) for errors
```

### "Model not loading"
```
→ Run training: python train_plastic_model.py
→ Check public/models/ exists
→ Check network tab (F12)
```

### "Slow detection"
```
→ Check FPS in app
→ Reduce model input size
→ Skip frames for faster processing
```

### "In demo mode"
```
→ This is normal if model not trained
→ Train model to get real detection
→ Or test UI with simulated data
```

---

## 💡 Tips

### Best Results
- ✅ Good lighting
- ✅ Point directly at object
- ✅ Get close to object
- ✅ Clear background
- ✅ Train with diverse data

### Performance
- ✅ Adjust confidence threshold
- ✅ Use strong GPU device
- ✅ Reduce video resolution
- ✅ Skip frames if too slow

### Training
- ✅ Collect 500+ images per type
- ✅ Balance your dataset
- ✅ Use varied lighting
- ✅ Include different angles

---

## 🎯 Your System

```
Phone Camera (input)
    ↓
Browser (React UI)
    ↓
Canvas (frame capture)
    ↓
TensorFlow.js (AI model on phone)
    ↓
Detection Results
    ↓
Bounding Boxes & Confidence
```

**ALL PROCESSING HAPPENS ON YOUR PHONE** 🔒

---

## 📚 Full Docs

- `PLASTIC_DETECTION_SETUP.md` - Complete setup guide
- `BACKEND_README.md` - Feature documentation
- `IMPLEMENTATION_COMPLETE.md` - What's built
- `IMPLEMENTATION_CHECKLIST.md` - Detailed checklist

---

## 🚀 Deploy

### Frontend (Vercel/Netlify)
```bash
npm run build
# Upload dist/ folder
```

### Backend (Heroku/Railway)
```bash
npm run build
npm start
```

---

## ✨ Status

✅ Backend: Ready
✅ Frontend: Ready
✅ AI Model: Ready
✅ Training: Ready
✅ Documentation: Complete

**You're all set! Start with:**
```bash
npm install && npm run dev:all
```

Then open: http://localhost:3000

---

**Happy detecting! 🌍♻️**
