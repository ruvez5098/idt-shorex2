# 🔧 Troubleshooting Guide

## Before You Start

✅ **Check these first:**
1. Node.js installed? `node --version`
2. npm installed? `npm --version`
3. Dependencies installed? `npm install`
4. Python installed (for training)? `python --version`

---

## Common Issues & Solutions

### 🚀 Installation & Setup

#### Issue: `npm install` fails
**Problem:** Dependencies won't install
**Solutions:**
```bash
# Try clearing cache
npm cache clean --force

# Delete node_modules and try again
rm -rf node_modules package-lock.json
npm install

# Use specific Node version
node --version  # Should be 16+
```

#### Issue: Permission denied during install
**Problem:** Trying to install as root or permission issues
**Solutions:**
```bash
# On macOS/Linux
sudo npm install

# Or better - fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
export PATH=~/.npm-global/bin:$PATH
npm install
```

#### Issue: Python not found
**Problem:** `pip install -r requirements.txt` fails
**Solutions:**
```bash
# Check Python version
python --version  # Should be 3.8+

# If not found, install from python.org
# Then try pip directly
python -m pip install -r requirements.txt

# Or try pip3
pip3 install -r requirements.txt
```

---

## 🌐 Development Server Issues

### Issue: Port already in use
**Problem:** `Error: listen EADDRINUSE: address already in use :::3000`
**Solutions:**
```bash
# Kill process using port 3000
# macOS/Linux
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or use different port
npm run dev -- --port 3001
```

### Issue: "Cannot GET /"
**Problem:** Frontend loading blank page
**Solutions:**
```bash
# Make sure you're running dev server
npm run dev

# Check it's actually running
curl http://localhost:3000

# Check browser console (F12) for errors

# Try hard refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

### Issue: Backend not starting
**Problem:** `npm run server` fails
**Solutions:**
```bash
# Check if port 5000 is free
# macOS/Linux
lsof -i :5000

# Windows
netstat -ano | findstr :5000

# Try different port
PORT=8000 npm run server

# Or just frontend
npm run dev
```

---

## 📱 Camera Issues

### Issue: "Camera permission denied"
**Problem:** Browser won't access camera
**Solutions:**
1. **Check browser permissions:**
   - Chrome: Settings → Privacy → Camera
   - Firefox: Preferences → Permissions → Camera
   - Safari: System Preferences → Security & Privacy
   
2. **Try incognito mode:**
   ```
   Firefox: Ctrl+Shift+P
   Chrome: Ctrl+Shift+N
   Safari: Cmd+Shift+N
   ```

3. **Clear site data:**
   - Go to the website
   - Press F12 (DevTools)
   - Application → Storage → Clear Site Data

4. **Use localhost:**
   - HTTPS required for remote access
   - Localhost (127.0.0.1:3000) works without HTTPS

### Issue: "Camera not working"
**Problem:** Camera stream black or frozen
**Solutions:**
```bash
# Check browser console (F12)
# Look for errors

# Try different browser
# Chrome → Firefox → Safari

# Restart browser
# Close and reopen

# Check if other apps use camera
# Close Zoom, teams, OBS, etc.
```

### Issue: Slow camera/low FPS
**Problem:** Video feed is choppy
**Solutions:**
1. Close other browser tabs
2. Reduce screen brightness (sometimes helps)
3. Move away from WiFi interference
4. Use Ethernet if possible
5. Try lower resolution:
   ```
   Edit src/PlasticDetector.tsx
   Change width/height ideal values
   ```

---

## 🤖 AI & Model Issues

### Issue: "Model failed to load"
**Problem:** TensorFlow.js can't find model files
**Solutions:**
```bash
# 1. Train the model first
python train_plastic_model.py --epochs 10

# 2. Check model files exist
# Should have:
# public/models/plastic-detection-model.json
# public/models/plastic-detection-model/group*.bin

# 3. Check browser console (F12) Network tab
# Look for 404 errors

# 4. Verify file paths in plasticDetection.ts
```

### Issue: "Using demo mode" (doesn't train)
**Problem:** Using simulated detection instead of real
**Solutions:**
```bash
# This is normal if model not trained!

# To fix:
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Train the model
python train_plastic_model.py --epochs 10

# 3. Refresh browser
# Model should load now
```

### Issue: "No detections found"
**Problem:** Model runs but doesn't detect anything
**Solutions:**
1. **Adjust confidence threshold:**
   - Move slider down to 0.3 or 0.2
   - Sometimes detections have low confidence

2. **Check if model is trained:**
   - If using demo mode, detection is simulated
   - Train model for real detection

3. **Improve lighting:**
   - Good natural light helps
   - Avoid shadows and backlighting

4. **Get closer to object:**
   - Model might need to see object clearly

5. **Try different angle:**
   - Rotate phone/object

6. **Retrain with better data:**
   - Collect more diverse images
   - Include various lighting conditions

### Issue: "Out of memory"
**Problem:** Browser tab crashes or freezes
**Solutions:**
```bash
# Stop detection
# Let page sit for a moment

# Reload page
# Ctrl+R (Windows/Linux)
# Cmd+R (Mac)

# Use smaller model input
# Edit src/plasticDetection.ts
# Change 416 to smaller number (e.g., 320)

# Skip frames
# Edit src/PlasticDetector.tsx
# Process every 2nd frame instead
```

---

## 📊 Training Issues

### Issue: "TensorFlow installation failed"
**Problem:** `pip install tensorflow` fails
**Solutions:**
```bash
# Use specific version
pip install tensorflow==2.15.0

# Try with explicit Python path
python -m pip install tensorflow

# Use conda instead
conda install tensorflow

# Or use CPU version
pip install tensorflow-cpu
```

### Issue: "Training is very slow"
**Problem:** Model training takes forever
**Solutions:**
```bash
# Reduce dataset size in train script
# Reduce epochs:
python train_plastic_model.py --epochs 5

# Reduce batch size:
python train_plastic_model.py --batch-size 8

# Use GPU (if available)
# Verify TensorFlow can see GPU:
python -c "import tensorflow as tf; print(tf.config.list_physical_devices('GPU'))"
```

### Issue: "Model conversion to TensorFlow.js failed"
**Problem:** Python script errors during conversion
**Solutions:**
```bash
# Check tensorflowjs is installed
pip install tensorflowjs

# Try manual conversion
tensorflowjs_converter \
  --input_format=tf_saved_model \
  --output_format=tfjs_graph_model \
  public/models/plastic-detection-savedmodel \
  public/models/plastic-detection-model

# Check if public/models/ exists
mkdir -p public/models
```

---

## 🌐 Network & Deployment

### Issue: "Can't access from phone"
**Problem:** Phone can't reach `http://computer-ip:3000`
**Solutions:**
```bash
# 1. Get correct IP
# Windows
ipconfig

# macOS/Linux
ifconfig | grep inet

# 2. Make sure not 127.0.0.1 or localhost
# Phone needs: http://ACTUAL_IP:3000

# 3. Check firewall
# Windows Defender → Allow app
# macOS → System Preferences → Security
# Linux → ufw allow 3000

# 4. Check WiFi connection
# Phone and computer must be same network
```

### Issue: "CORS error"
**Problem:** Frontend can't call backend API
**Solutions:**
```bash
# This shouldn't happen in dev, but if it does:

# Make sure both servers running
npm run dev:all

# Check backend is on port 5000
# Check frontend can reach it
curl http://localhost:5000/api/health

# For production, add CORS headers to server.ts
```

### Issue: "Blank page on deployment"
**Problem:** App doesn't load on production
**Solutions:**
```bash
# 1. Build locally first
npm run build

# 2. Check dist/ has files
ls dist/

# 3. Upload dist/ folder, NOT node_modules/

# 4. Check build output for errors
npm run build 2>&1 | tee build.log

# 5. Check server is serving static files
# Should serve dist/index.html by default
```

---

## 📋 Performance Issues

### Issue: "Low FPS (slow detection)"
**Problem:** Only getting 5-10 FPS instead of 20+
**Solutions:**
```bash
# 1. Close other apps
# Browser tabs, background apps

# 2. Reduce inference frequency
# Edit src/PlasticDetector.tsx
// Process every 2nd frame:
if (frameCount % 2 !== 0) continue;

# 3. Lower resolution
// Edit src/PlasticDetector.tsx
// Change ideal width/height

# 4. Use smaller model
// In train_plastic_model.py
// Use MobileNet backbone instead
```

### Issue: "High battery drain"
**Problem:** App drains battery quickly
**Solutions:**
1. Stop detection when not using
2. Reduce inference frequency (every 2nd frame)
3. Use lower resolution camera
4. Disable GPU if available
5. Reduce FPS monitoring

---

## 🐛 Development Issues

### Issue: "TypeScript errors"
**Problem:** TSX won't compile
**Solutions:**
```bash
# Check for syntax errors
npm run lint

# Fix all auto-fixable issues
npm run lint -- --fix

# Clear cache
rm -rf dist .vite

# Try building
npm run build
```

### Issue: "Module not found"
**Problem:** `Cannot find module '@/...'`
**Solutions:**
1. Check file exists
2. Check path is correct
3. Check tsconfig.json has paths config
4. Try restarting dev server
5. Check file extensions (.ts vs .tsx)

### Issue: "React component not rendering"
**Problem:** Component appears blank
**Solutions:**
```bash
# Check browser console (F12) for errors

# Check component is exported
// In component file:
export const ComponentName = () => { ... }

// In parent:
import { ComponentName } from './ComponentName'

# Check component is actually rendered
// Should be in JSX:
<ComponentName />
```

---

## 🆘 Emergency Fixes

### "Everything is broken"
**Nuclear option - start fresh:**
```bash
# Clean everything
rm -rf node_modules dist .vite public/models
rm package-lock.json

# Reinstall
npm install

# Clear Python cache
pip cache purge

# Reinstall Python packages
pip install -r requirements.txt

# Start fresh
npm run dev:all
```

### "Page frozen"
**Quick fix:**
```bash
# Hard refresh browser
Ctrl+Shift+Delete (Windows/Linux)
Cmd+Option+Delete (Mac)

# Clear cache and reload
F12 → Application → Cache → Clear All

# Close browser completely
# Reopen
```

### "Can't connect to server"
**Quick fix:**
```bash
# Kill all Node processes
# Windows
taskkill /F /IM node.exe

# macOS/Linux
pkill -f node

# Restart everything
npm run dev:all
```

---

## 📞 Getting Help

### When asking for help, include:
```
1. Error message (copy from console)
2. Your OS (Windows/Mac/Linux)
3. Browser (Chrome/Firefox/Safari)
4. Node version (node --version)
5. Python version (python --version)
6. Steps to reproduce
7. What you tried to fix it
```

### Check these first:
1. Browser console (F12) for errors
2. Backend terminal for server errors
3. Network tab (F12) for failed requests
4. Check all npm scripts are running
5. Try on different browser

---

## 📚 Additional Resources

- **TensorFlow.js Docs**: https://js.tensorflow.org/
- **React Docs**: https://react.dev/
- **Express Docs**: https://expressjs.com/
- **Browser DevTools**: https://developer.chrome.com/docs/devtools/

---

## ✅ Checklist Before Asking for Help

- [ ] Tried restarting everything
- [ ] Checked browser console (F12)
- [ ] Ran `npm install`
- [ ] Both servers running (frontend + backend)
- [ ] Tried different browser
- [ ] Checked firewall/permissions
- [ ] Looked at backend terminal logs
- [ ] Verified ports are free
- [ ] Tried on localhost first
- [ ] Read this troubleshooting guide

---

**Most issues are solved by:** `npm install && npm run dev:all`

**Still stuck?** Check the documentation in FINAL_SUMMARY.md or BACKEND_README.md
