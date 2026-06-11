# SHOREX Website Project Report

## 1. Project Title

SHOREX - AI Plastic Detection Website

## 2. Introduction

SHOREX is a modern web application built to demonstrate an AI-powered plastic detection solution. The site is implemented with a React front-end and an Express backend, using TensorFlow.js to perform real-time plastic detection in the browser.

## 3. Project Overview

The SHOREX website enables users to point a phone camera at objects and detect plastics in real time. It was created as a complete AI-enabled web solution that runs mostly on the client side, while offering backend support for hosting and optional model operations.

## 4. Objectives

- Build a responsive web application with a user-friendly camera interface.
- Integrate real-time plastic detection using TensorFlow.js.
- Keep all model inference and detection processing local for privacy.
- Provide a complete development and deployment experience with a backend server.
- Support mobile access from smartphones using the same web app.

## 5. Key Features

- Real-time plastic detection using the device camera.
- Live video feed with bounding boxes and confidence scores.
- Mobile-compatible interface for phone browser use.
- Local AI processing: no data is sent externally.
- Demo mode for immediate testing and model training support.
- Express.js backend for API support and model serving.

## 6. System Architecture

The SHOREX system follows a client-server architecture with local browser-based AI inference.

1. User opens the SHOREX website in a browser.
2. The React front-end launches the camera and captures video frames.
3. Captured video frames are processed with TensorFlow.js in the browser.
4. The AI model identifies plastic objects and renders bounding boxes.
5. The Express.js backend provides optional API endpoints and server-side support.

## 7. Technology Stack

- Frontend: React, Vite, TypeScript
- Styling: CSS
- AI / Machine Learning: TensorFlow.js
- Backend: Express.js, Node.js
- Training: Python script (`train_plastic_model.py`)

## 8. Project Files Summary

- `index.html`: Main HTML entry point for the SHOREX web app.
- `src/App.tsx`: Main application layout and navigation.
- `src/PlasticDetector.tsx`: Camera UI and detection controls.
- `src/plasticDetection.ts`: TensorFlow.js model loading and inference.
- `server.ts`: Express backend for API endpoints and support.
- `train_plastic_model.py`: Python training script for model creation.
- `package.json`: Project dependencies and scripts.
- `README.md`: Usage instructions and overview.
- `FINAL_SUMMARY.md`: Full project summary.
- `PLASTIC_DETECTION_SETUP.md`: Detailed setup guide.

## 9. Deployment and Usage

### Local deployment

- Install dependencies:
  ```bash
  npm install
  ```
- Run both frontend and backend:
  ```bash
  npm run dev:all
  ```
- Open the web app on a phone or desktop:
  - Frontend: `http://localhost:3000`
  - Backend: `http://localhost:5000`

### User workflow

1. Open the SHOREX app in a browser.
2. Navigate to the `Plastic AI` section.
3. Tap `Start Detection` and allow camera access.
4. Point the camera at plastics.
5. Observe bounding boxes, confidence scores, and FPS output.

## 10. AI Model and Training

SHOREX includes a training pipeline for a plastic detection model.

- The model is trained using a Python script: `train_plastic_model.py`.
- Training requires Python dependencies defined in `requirements.txt`.
- The app supports a demo mode for immediate testing without prior model training.
- For production, users can replace the demo dataset with real images and use custom training data.

## 11. Benefits

- Fast, private on-device AI detection.
- Works on smartphones in a browser without data leaks.
- Easy to run locally with simple commands.
- Flexible architecture that supports future model improvements.

## 12. Limitations and Future Work

- Detection accuracy depends on training data quality.
- Mobile performance may vary by device hardware.
- Additional polishing can improve user experience and detection UI.
- Future improvements may include model optimization, multi-class detection, and a full production deployment pipeline.

## 13. Conclusion

The SHOREX website demonstrates a working AI-based plastic detection solution built on modern web technologies. It is designed to be usable on phones, private by performing inference locally, and extendable through additional training and deployment enhancements.

---

This report is based on the existing project website content, adapted to the SHOREX name and project context.
