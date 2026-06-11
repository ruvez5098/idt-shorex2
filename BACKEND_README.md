# SHOREX - Plastic Detection System

A full-stack real-time plastic detection system using AI/ML, perfect for environmental monitoring and waste management on mobile devices.

## ✨ Features

- **🎥 Real-time Camera Feed**: Access phone camera with live video streaming
- **🤖 AI Plastic Detection**: Custom-trained TensorFlow.js model for accurate plastic identification
- **📱 Mobile Optimized**: Works on both Android and iOS phones through web browser
- **⚡ Client-side Processing**: All AI inference runs on your device (no data sent to server)
- **📊 Real-time Metrics**: FPS counter, confidence scores, and detection counts
- **🎚️ Adjustable Confidence**: Filter detections by confidence threshold
- **🌐 Offline Capable**: Works completely offline after initial model download
- **🔒 Privacy-First**: Zero data collection, runs entirely locally

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Train the AI Model
```bash
# Install Python dependencies
pip install -r requirements.txt

# Train the custom plastic detection model
python train_plastic_model.py --epochs 50 --batch-size 16
```

Model files will be created in `public/models/`

### 3. Start Development Servers
```bash
# Terminal 1: Frontend (React + Vite)
npm run dev

# Terminal 2: Backend (Express)
npm run server

# Or run both together:
npm run dev:all
```

### 4. Access the App
- **Frontend**: http://localhost:3000 (or your phone's IP)
- **Backend**: http://localhost:5000
- **Health Check**: http://localhost:5000/api/health

### 5. Use Plastic Detection
1. Open the app in your phone browser
2. Navigate to **"Plastic AI"** tab
3. Click **"Start Detection"** and allow camera access
4. Point camera at objects to detect plastics
5. Adjust confidence threshold as needed

## 📁 Project Structure

```
shorex/
├── src/
│   ├── App.tsx                    # Main application & navigation
│   ├── PlasticDetector.tsx        # Camera + detection UI component
│   ├── plasticDetection.ts        # TensorFlow.js ML service
│   ├── main.tsx                   # React entry point
│   └── index.css                  # Global styles
├── server.ts                       # Express.js backend server
├── train_plastic_model.py         # Model training script
├── public/
│   └── models/                     # Trained TensorFlow.js models
├── package.json                    # Node.js dependencies
├── requirements.txt                # Python dependencies
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript configuration
└── README.md
```

## 🔧 Technology Stack

### Frontend
- **React 19.0.1** - UI framework
- **Vite 6.2.3** - Build tool & dev server
- **Tailwind CSS 4.1.14** - Styling
- **TensorFlow.js 4.11.0** - Client-side ML inference
- **Lucide React** - Icons
- **Motion** - Animations

### Backend
- **Express.js 4.21.2** - Web server
- **Node.js** - Runtime
- **TypeScript** - Type safety

### ML/AI
- **TensorFlow** - Model training (Python)
- **TensorFlow.js** - Model inference (JavaScript)
- **NumPy** - Data processing (Python)

## 🤖 Model Architecture

The custom plastic detection model:
- **Input**: 416x416 RGB images
- **Backbone**: 4-layer CNN with max pooling & ReLU activation
- **Head**: 2-layer dense network with dropout
- **Output**: 85 values per frame (coordinates, confidence, class predictions)
- **Model Size**: ~5-10 MB after TensorFlow.js conversion
- **Inference Speed**: 20-60 FPS on modern devices

## 📊 Training Your Own Model

### Dataset Preparation
```
dataset/
├── plastic/
│   ├── bottle1.jpg
│   ├── bottle2.jpg
│   ├── bag1.jpg
│   └── ... (500+ images)
└── non_plastic/
    ├── rock1.jpg
    ├── plant1.jpg
    ├── wood1.jpg
    └── ... (500+ images)
```

### Training Command
```bash
python train_plastic_model.py \
  --epochs 50 \
  --batch-size 16 \
  --data-dir ./dataset \
  --output-dir ./public/models
```

### Tips for Better Accuracy
- Collect 1000+ labeled images per category
- Use diverse lighting conditions
- Include various angles and distances
- Use data augmentation
- Balance dataset evenly
- Start with transfer learning from MobileNet

## 🌐 API Endpoints

### Health Check
```bash
GET /api/health
# Response: { "status": "ok", "timestamp": "2024-01-01T12:00:00Z" }
```

### Optional Server-side Detection
```bash
POST /api/detect
# Request: { "frame": "base64_encoded_image" }
# Response: { "detections": [...] }
```

### Model File Serving
```bash
GET /api/model/:filename
# Serves model weights and architecture files
```

## 📱 Mobile Usage

### On Android
1. Open Chrome/Firefox browser
2. Go to `http://your-computer-ip:3000`
3. Navigate to "Plastic AI" tab
4. Grant camera permissions
5. Start detecting!

### On iPhone/iPad
1. Open Safari
2. Go to `http://your-computer-ip:3000` (requires HTTPS in production)
3. Add to home screen (optional)
4. Grant camera permissions
5. Start detecting!

## ⚙️ Configuration

### Adjust Model Input Size
In `src/plasticDetection.ts`:
```typescript
const resized = tf.image.resizeBilinear(imageTensor, [512, 512]); // Change to desired size
```

### Change Confidence Threshold
In `src/PlasticDetector.tsx`:
```typescript
const [confidence, setConfidence] = useState(0.6); // Default 60%
```

### Frame Processing Speed
Add frame skipping for better performance:
```typescript
if (frameCount % 2 === 0) { // Process every 2nd frame
  // Run detection
}
```

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Camera not working | Check browser permissions, ensure HTTPS (except localhost) |
| Model not loading | Run training script, check `public/models/` directory exists |
| Low FPS | Reduce input resolution, skip frames, check GPU |
| No detections | Train with more diverse data, adjust confidence threshold |
| Out of memory | Use smaller model, reduce batch size during training |

## 📈 Performance Optimization

### For Production
```bash
# Build optimized production bundle
npm run build

# Test build locally
npm run preview
```

### Model Optimization
1. **Quantization**: Reduce model size by 4x
2. **Pruning**: Remove unnecessary connections
3. **Knowledge Distillation**: Train smaller student model

### Deployment
```bash
# Deploy to Vercel/Netlify
npm run build
# Upload 'dist/' folder

# Deploy to Heroku
npm run build
npm start
```

## 🔒 Privacy & Security

- ✅ **No Data Collection**: All processing happens locally
- ✅ **No Server Storage**: Camera frames are not saved
- ✅ **No Analytics**: No tracking or telemetry
- ✅ **Offline Capable**: Works without internet
- ✅ **Open Source**: Code is transparent and auditable

## 📚 Documentation

- [Setup Guide](./PLASTIC_DETECTION_SETUP.md) - Detailed setup instructions
- [TensorFlow.js Docs](https://js.tensorflow.org/)
- [React Documentation](https://react.dev/)
- [Vite Guide](https://vitejs.dev/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is open source and available under the MIT License.

## 🙋 Support

For issues and questions:
1. Check the [Setup Guide](./PLASTIC_DETECTION_SETUP.md)
2. Review browser console (F12) for errors
3. Check backend logs
4. Read TensorFlow.js documentation

## 🎯 Roadmap

- [ ] Multi-object detection (detect multiple plastic types)
- [ ] Historical tracking & statistics
- [ ] Export detection data
- [ ] WebRTC for remote detection
- [ ] Advanced model architectures (YOLO v8, ResNet)
- [ ] Fine-tuning UI in browser
- [ ] Database for storing detections
- [ ] Mobile app (React Native)

## 💡 Use Cases

- ♻️ **Waste Management**: Automatic plastic waste sorting
- 🌍 **Environmental Monitoring**: Track plastic pollution
- 🏭 **Industrial**: Quality control in manufacturing
- 🎓 **Education**: Teaching AI & computer vision
- 📊 **Research**: Data collection for ML studies
- ♾️ **Sustainability**: Support environmental initiatives

## 📞 Contact

- **Project**: SHOREX - Plastic Detection
- **Status**: Active Development
- **Version**: 1.0.0

---

**Made with ❤️ for environmental sustainability** 🌱
