# Plastic Detection System - Complete Setup Guide

## 📋 Overview

This is a full-stack application that detects plastic in real-time using your phone's camera. The system includes:
- **Frontend**: React + Vite with real-time camera feed processing
- **Backend**: Express.js server for model serving and optional server-side inference
- **ML Model**: Custom-trained TensorFlow.js model for plastic detection
- **AI Detection**: Real-time plastic detection with bounding boxes and confidence scores

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:
- React, Vite, Tailwind CSS (frontend)
- Express.js (backend)
- TensorFlow.js (ML inference)
- TypeScript, ESBuild (development tools)

### 2. Train the Plastic Detection Model

The project includes a Python script to train a custom plastic detection model:

```bash
# First install Python dependencies
pip install tensorflow numpy pillow pyyaml tensorflowjs

# Train the model (uses dummy data for demo)
python train_plastic_model.py --epochs 10 --batch-size 16

# Output will be saved to public/models/
```

**For Production Use:**
- Replace the dummy dataset with real plastic images
- Use directory structure:
  ```
  dataset/
  ├── plastic/
  │   ├── image1.jpg
  │   ├── image2.jpg
  │   └── ...
  └── non_plastic/
      ├── image1.jpg
      ├── image2.jpg
      └── ...
  ```
- Update the training script to load real images
- Collect 1000+ labeled images per category for best results

### 3. Create Models Directory

```bash
mkdir -p public/models

# After training, model files will be:
# public/models/plastic-detection-model.json (model architecture)
# public/models/plastic-detection-model/group*.bin (weights)
```

### 4. Run Development Server

```bash
# Terminal 1: Frontend dev server (port 3000)
npm run dev

# Terminal 2: Backend server (port 5000)
npm run server

# Or run both together:
npm run dev:all
```

**Access the app:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Health check: http://localhost:5000/api/health

## 📱 Using the Plastic Detector

1. **Open the app** in your phone browser or desktop
2. **Navigate to "Plastic AI"** tab at the bottom
3. **Click "Start Detection"** to enable camera access
4. **Point at plastics** to see real-time detection with:
   - Red bounding boxes around detected plastics
   - Confidence percentage
   - FPS counter
5. **Adjust confidence threshold** slider to filter results
6. **Click "Stop Detection"** to stop

## 🏗️ Project Structure

```
shorex/
├── src/
│   ├── App.tsx                 # Main app with navigation
│   ├── PlasticDetector.tsx    # Camera + detection UI
│   ├── plasticDetection.ts    # TensorFlow.js model service
│   ├── main.tsx               # React entry point
│   └── index.css              # Styles
├── server.ts                   # Express backend
├── train_plastic_model.py      # Model training script
├── public/
│   └── models/                 # Trained model files
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript config
├── package.json               # Dependencies & scripts
└── README.md
```

## 🎯 Key Features

### Real-time Detection
- Processes video frames continuously
- Displays FPS (frames per second)
- Shows confidence scores for each detection

### Adjustable Confidence
- Slider to filter detections by confidence
- Helps reduce false positives

### Mobile Optimized
- Uses environment-facing camera (default)
- Supports both portrait and landscape
- Low latency processing

### GPU Acceleration
- Uses WebGL backend for GPU acceleration on supported devices
- Falls back to CPU automatically

## 🔧 Configuration

### Model Input Size
In `plasticDetection.ts`, adjust the model input size:
```typescript
const resized = tf.image.resizeBilinear(imageTensor, [416, 416]); // Change dimensions
```

### Confidence Threshold Default
In `PlasticDetector.tsx`:
```typescript
const [confidence, setConfidence] = useState(0.5); // Default 50%
```

### Detection Interval
Add frame throttling in detection loop (optional):
```typescript
const frameSkip = 2; // Process every 2nd frame
```

## 📊 Model Architecture

The trained model:
- **Input**: 416x416 RGB image
- **Backbone**: 4-layer CNN with max pooling
- **Detection Head**: 2-layer dense network
- **Output**: 85 values (x, y, w, h, confidence, class probabilities)
- **File Size**: ~5-10 MB (after quantization)

## 🌐 Deployment

### Deploy Frontend (Vercel/Netlify)
```bash
npm run build
# Deploy 'dist/' folder
```

### Deploy Backend (Heroku/Railway)
```bash
npm run build
npm start
```

### Production Considerations
- HTTPS required for camera access (except localhost)
- Add CORS headers if frontend and backend on different domains
- Consider model quantization for faster loading
- Cache model in browser local storage

## 🐛 Troubleshooting

### "Camera permission denied"
- Check browser permissions for camera
- Ensure HTTPS or localhost
- Try in incognito/private mode

### "Model failed to load"
- Verify `public/models/` directory exists
- Check network tab in browser DevTools
- Ensure model files are correctly formatted

### "Low FPS / Slow detection"
- Reduce input image resolution
- Skip some frames (frame throttling)
- Use lower confidence threshold
- Check GPU availability in DevTools

### "No detections found"
- Model might need more training
- Check if object is in training dataset
- Try different lighting conditions
- Increase confidence threshold

## 📚 Training Tips

### Dataset Preparation
1. Collect 500-1000+ plastic images
2. Collect 500-1000+ non-plastic images
3. Annotate with bounding boxes (use CVAT, LabelImg)
4. Balance dataset across categories

### Model Improvements
- Use data augmentation (rotation, brightness, etc.)
- Add weight regularization to prevent overfitting
- Use transfer learning from pre-trained models
- Collect more diverse samples

### Fine-tuning
Update `train_plastic_model.py`:
```python
# Use pre-trained backbone
from tensorflow.keras.applications import MobileNetV3Small
base_model = MobileNetV3Small(weights='imagenet', include_top=False)
```

## 📝 API Endpoints

### GET /api/health
Health check endpoint
```bash
curl http://localhost:5000/api/health
```

### POST /api/detect
Optional server-side detection (for fallback)
```bash
curl -X POST http://localhost:5000/api/detect \
  -H "Content-Type: application/json" \
  -d '{"frame": "base64_encoded_image"}'
```

### GET /api/model/:filename
Serves model files
```
http://localhost:5000/api/model/plastic-detection-model.json
```

## 🤝 Integration with SHOREX

The plastic detector integrates with your existing SHOREX system:
- New "Plastic AI" tab in bottom navigation
- Shares styling and UI framework
- Compatible with existing authentication system
- Works alongside other detection modes

## 📦 Build for Production

```bash
npm run build

# This creates:
# dist/                 - Frontend build
# public/models/        - TensorFlow.js models (served as static files)
# server.ts            - Backend ready for deployment
```

## 🔒 Security Notes

- Camera access is local browser only
- Model runs entirely on client (no data sent to server)
- Can be used completely offline after initial load
- No personal data collection or storage

## 📞 Support

For issues:
1. Check browser console for errors (F12)
2. Check backend logs
3. Review TensorFlow.js documentation
4. Check model file sizes and formats

## Next Steps

1. ✅ Install dependencies
2. ✅ Train the model with real data
3. ✅ Run development servers
4. ✅ Test plastic detection on your phone
5. 🚀 Deploy to production
