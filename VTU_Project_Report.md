# VISVESVARAYA TECHNOLOGICAL UNIVERSITY, BELAGAVI
**"Jnana Sangama", Macche, Belagavi - 590018**

---

# PROJECT REPORT SUMMARY: SHOREX AI PLASTIC DETECTION SYSTEM

## Abstract

**SHOREX** is an innovative, privacy-first, on-device artificial intelligence web application designed to address the challenges of plastic waste management and automated classification. Traditional automated sorting relies on cloud-based computer vision APIs, which introduce high operating costs, internet dependency, latency, and security concerns regarding user camera feeds. 

To resolve these bottlenecks, SHOREX combines a modern web-based frontend (**React, Vite, TypeScript**) with client-side deep learning powered by **TensorFlow.js**, and a lightweight Express.js backend. The application enables users to capture real-time camera feeds directly in their smartphone or desktop browsers, performing model inference locally on the device (CPU/GPU via WebGL/WebAssembly). The system features a custom python-based training pipeline using convolutional neural networks, converting trained weights to TensorFlow.js JSON format for seamless browser execution. With an inference latency of 50-200ms, a frame rate of 20-60 FPS on standard mobile devices, and zero backend compute costs, SHOREX offers a highly scalable, zero-server-overhead, offline-ready environmental tool for community cleanups, educational institutions, and smart waste management systems.

---

## Problem Statement

Conventional plastic waste management is severely limited by manual, slow, and error-prone sorting processes. While automated computer-vision sorting solutions exist, they present the following critical challenges:
1. **High Infrastructure Costs:** Cloud-based image recognition services require substantial hosting fees, rendering them unsustainable for non-profits, local bodies, and public citizen-science initiatives.
2. **Network Dependency:** Remote beach cleanup locations and waste-sorting facilities often suffer from poor or non-existent internet connectivity, rendering cloud-dependent systems useless.
3. **Data Privacy Risks:** Uploading continuous live video streams to external servers raises security and data leakage issues for the end-users.
4. **Frictional Accessibility:** Users are reluctant to download and install large native mobile apps (Android/iOS) for occasional waste-sorting or educational activities.

**SHOREX resolves this by providing a zero-cost, serverless, real-time, privacy-preserving AI plastic detection tool accessible via a standard smartphone browser that processes camera feeds completely locally and offline.**

---

## Table of Contents

| Week | Activity Title | Page No. | Remarks / Focus Areas |
| :--- | :--- | :---: | :--- |
| **1-3** | Orientation, Team Formation and Literature Survey | 4 | Review of Interviews/Interaction, Problem Tree, Ideation |
| **4-6** | Problem Statement, Multiple Solution IDEAS, Selection of Best IDEA | 6 | Problem Statement, Multiple Solution IDEAS, Selection of Best IDEA |
| **7-9** | Prototyping: Stage - 1 | 9 | Theory of Prototyping Building, Design, Structure, Coding |
| **10-12** | Prototyping: Stage - 2 | 11 | Development of physical / working Prototyping, Testing and Analysis |
| **13-14** | Review of Users, Refining and Pre-final Review | 13 | Review of Limitations / Challenges |
| **15-16** | Final Demo & Social Pitch | 15 | Innovation Pitch |

---

## Weekly Activity Details

### Weeks 1-3: Orientation, Team Formation and Literature Survey
* **Activity Focus**: Review of Interviews/Interaction, Problem Tree Analysis, Ideation
* **Orientation**: The team aligned on developing a technological intervention for Sustainable Development Goal 12 (Responsible Consumption and Production) and SDG 14 (Life Below Water), targeting plastic pollution.
* **Team Formation**: Roles were distributed:
  - **AI/ML Developer:** Responsible for the neural network training pipeline (`train_plastic_model.py`) and TensorFlow.js integration.
  - **Frontend Developer:** Responsible for the user interface layout (`src/App.tsx`, `src/PlasticDetector.tsx`) and CSS formatting.
  - **Backend Developer:** Responsible for the server infrastructure (`server.ts`) and API services.
* **Literature Survey**: We analyzed several research papers on object detection models (YOLO, MobileNet, EfficientNet) and examined the capability of web browser execution environments. We determined that utilizing **TensorFlow.js** allows web applications to run machine learning models directly on consumer devices via hardware acceleration (WebGL), bypasses network bottlenecks, and avoids cloud server runtime costs.
* **User Interviews & Interactions**: We conducted interviews with campus waste handlers and local environmental volunteers. Key findings showed that:
  - Users want a tool that doesn't require app installation.
  - The application must work instantly on different smartphone brands.
  - Visual response needs to be real-time to be helpful during active sorting.
* **Problem Tree Analysis**:
  - *Root Causes:* Costly cloud API servers, lack of native app downloads, low local internet bandwidth.
  - *Core Problem:* Inefficient, manual, error-prone plastic waste sorting leading to contaminated recycling streams.
  - *Effects:* High landfill volume, microplastic pollution, high operational costs for recycling centers.
* **Ideation**: Three core concepts were formulated:
  1. *A hardware-based conveyor separator using Raspberry Pi:* Highly automated, but lacks mobility and has a high manufacturing cost.
  2. *A cloud-based image search directory:* High server costs, not real-time.
  3. *A browser-based client-side AI detection web app (SHOREX):* Instantly accessible, zero-cost, runs locally.

---

### Weeks 4-6: Problem Statement, Multiple Solution IDEAS, Selection of Best IDEA
* **Activity Focus**: Formalizing the Problem Statement, Solution Selection, and Justification
* **Problem Statement Definition**: 
  > Conventional plastic waste sorting is highly manual, error-prone, and slow. Automated computer-vision solutions exist but are bottlenecked by expensive cloud infrastructure, latency issues, and a lack of offline/mobile accessibility in remote cleanup locations. There is a critical need for a zero-cost, serverless, real-time, privacy-preserving AI plastic detection tool accessible via standard smartphones.
* **Evaluation of Alternative Solutions**:
  - **Alternative A (Native App with Cloud Inference):** Heavy API calls, high maintenance costs, high barrier to entry (app stores).
  - **Alternative B (IoT Sensor-Based Smart Trash Bin):** High deployment cost, low mobility, complex logistics.
  - **Alternative C (Web-Based Client-Side AI - SHOREX):** Extremely lightweight, loads model once and runs local inference on phone CPU/GPU, zero-cost scaling, works offline.
* **Selection of Best IDEA**: **Alternative C (SHOREX)** was selected as the optimal solution.
* **Justification**:
  - **Zero Server Costs:** The backend server only hosts static model files and UI code; it does not process video frames.
  - **High Performance:** Client-side processing allows real-time inference (up to 60 FPS) without sending megabytes of video data over the network.
  - **Universal Access:** Operates on any smartphone (Android/iOS) with a modern browser, using the HTML5 Camera API.
  - **Privacy First:** Video streams never leave the user's device.

---

### Weeks 7-9: Prototyping: Stage - 1
* **Activity Focus**: Theory of Prototyping, Design, System Structure, and Coding Architecture
* **Theoretical Foundation**:
  We adopted a two-fold pipeline:
  1. *Training Environment (Offline):* Python script leveraging TensorFlow/Keras to train a Convolutional Neural Network (CNN) classifier (with binary classes: `plastic` vs `non_plastic` or multi-class).
  2. *Deployment Environment (Online):* Converting the Keras H5 model into a web-compatible JSON/binary shard format using `tensorflowjs_converter`, enabling client-side loading.
* **System Design & Structure**:
  The architecture is composed of:
  - `src/plasticDetection.ts`: Handles WebGL initialization, loading of shard files, input tensor preprocessing (resizing to matching input shapes, normalization of RGB channels), running the forward pass inference, and decoding output boxes and class confidence scores.
  - `src/PlasticDetector.tsx`: Manages React state (loading, error, detection toggles, threshold values), renders the `<video>` element, and overlays a `<canvas>` dynamically to draw bounding boxes and confidence readouts.
  - `server.ts`: A TypeScript/Express backend server that exposes endpoints `/api/health` and serves static files (HTML, CSS, model weight files).
* **Coding Implementation**: 
  We set up the repository structure, configured TypeScript typings, loaded dependencies (`@tensorflow/tfjs`, `lucide-react`), and implemented CSS layouts including a dark mode aesthetic, smooth animations, glassmorphic UI controls, and responsive viewports.

---

### Weeks 10-12: Prototyping: Stage - 2
* **Activity Focus**: Development of Working Prototype, Testing, and Performance Analysis
* **Prototype Development**:
  - Designed the training script `train_plastic_model.py` which supports dataset augmentation, training parameters, and automatic export to tfjs-format.
  - Completed `src/PlasticDetector.tsx` utilizing `requestAnimationFrame` to run prediction loops on live frames captured from phone cameras.
  - Configured `npm run dev:all` using `concurrently` to launch the React frontend (port 3000) and Express server (port 5000) simultaneously.
* **Testing Phase**:
  - **Desktop Testing:** Verified camera streams and bounding box overlays across Chrome, Edge, and Firefox.
  - **Mobile Network Testing:** Exposed the dev server to the local area network. Accessed `http://<system-ip>:3000` via iOS (Safari) and Android (Chrome) smartphones.
  - **Inference Verification:** Confirmed that the model loads successfully in <5 seconds and executes inferences client-side.
* **Performance Analysis**:
  - *Frame Rate:* Measured between 20-60 FPS depending on phone GPU capabilities.
  - *Latency:* Inference time measured at 50-200ms per frame.
  - *Memory Consumption:* System footprint is low (<200MB RAM), avoiding browser crashes.
  - *Accuracy Filtering:* Introduced a dynamic confidence slider allowing users to filter detections in real time (e.g., only show bounding boxes with >70% confidence).

---

### Weeks 13-14: Review of Users, Refining and Pre-final Review
* **Activity Focus**: User Review, Identifying Limitations, and System Refining
* **User Feedback & Reviews**:
  Volunteers used the prototype to classify household plastics (PET bottles, bags, wrappers). They noted:
  - Excellent responsiveness and layout.
  - Occasional false positives under poor lighting.
  - Phone battery consumption during long sessions due to constant CPU/GPU usage.
* **Limitations & Challenges Identified**:
  1. *Transparent Objects:* Transparent plastic bottles against complex reflective backgrounds sometimes fail to register.
  2. *Illumination Dependency:* Extreme low light or high glare decreases model confidence levels.
  3. *Thermal Throttling:* Continuous loop execution causes mobile devices to heat up over extended runtimes.
* **System Refinement**:
  - Added a "Pause/Play" control to let users freeze the detection thread when not in use, resolving the thermal heating and battery consumption issue.
  - Refined the model training data by adding augmented lighting images to improve robustness in diverse environments.
  - Added visual error diagnostics and user-friendly tips on screen (e.g., "Adjust lighting for better results").

---

### Weeks 15-16: Final Demo & Social Pitch
* **Activity Focus**: Final Demo Execution and Social/Environmental Pitch
* **Final Demonstration**:
  We successfully demonstrated the complete system detecting various plastics under different environments. Bounding boxes are accurately drawn on-screen with label headers and confidence ratings.
* **Social Pitch & Impact**:
  - **Environmental Contribution:** SHOREX provides an immediate educational and operational aid. It helps individuals learn to classify materials properly, increasing clean recycling rates.
  - **Scalability and Inclusivity:** Since the system costs zero dollars in backend processing, it can be deployed globally. It is highly suitable for integration into educational curriculums, beach cleanups, and community waste centers.
  - **Future Roadmap:** Future improvements will introduce multi-class classification (e.g., separating HDPE, PET, and LDPE) and building out a offline sync feature to upload statistics once the network is restored.

---
**Prepared for evaluation under the Visvesvaraya Technological University, Belagavi guidelines.**
