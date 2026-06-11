#!/bin/bash
# Quick start script for SHOREX Plastic Detection

echo "🚀 SHOREX - Plastic Detection Setup"
echo "=========================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js"
    exit 1
fi
echo "✅ npm found: $(npm --version)"

# Install Node dependencies
echo ""
echo "📦 Installing Node dependencies..."
npm install

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python 3 not found. ML model training will not work."
    echo "   Install from https://python.org to train custom models"
else
    echo "✅ Python 3 found: $(python3 --version)"
    
    # Install Python dependencies
    echo ""
    echo "📦 Installing Python dependencies..."
    pip install -r requirements.txt
    
    # Create models directory
    mkdir -p public/models
    
    # Ask about training
    echo ""
    read -p "Train AI model now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🤖 Training plastic detection model..."
        python3 train_plastic_model.py --epochs 10
    else
        echo "⏭️  Skipping model training. You can train later with:"
        echo "   python3 train_plastic_model.py --epochs 50"
    fi
fi

# Create public/models directory
mkdir -p public/models

echo ""
echo "✅ Setup complete!"
echo ""
echo "📚 Next steps:"
echo "1. Start frontend:  npm run dev"
echo "2. Start backend:   npm run server"
echo "3. Or both:         npm run dev:all"
echo ""
echo "🌐 Access the app at: http://localhost:3000"
echo ""
echo "📖 For more info, see: PLASTIC_DETECTION_SETUP.md"
