#!/bin/bash

# Pi Local Assistant Installation Script
# For Ubuntu on Raspberry Pi 5

set -e

echo "🤖 Pi Local Assistant Installer"
echo "================================"
echo ""

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model; then
    echo "⚠️  Warning: This doesn't appear to be a Raspberry Pi"
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check for Node.js
echo "📦 Checking Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Installing..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    NODE_VERSION=$(node -v)
    echo "✅ Node.js $NODE_VERSION installed"
fi

# Check for Ollama
echo ""
echo "📦 Checking Ollama..."
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama not found. Installing..."
    curl -fsSL https://ollama.com/install.sh | sh
    
    # Enable and start Ollama service
    sudo systemctl enable ollama
    sudo systemctl start ollama
    
    echo "✅ Ollama installed"
else
    echo "✅ Ollama already installed"
    
    # Make sure it's running
    if ! systemctl is-active --quiet ollama; then
        echo "Starting Ollama service..."
        sudo systemctl start ollama
    fi
fi

# Install npm dependencies
echo ""
echo "📦 Installing npm dependencies..."
npm install

# Pull recommended LLM model
echo ""
echo "🤖 Pulling recommended LLM model..."
echo "This may take a while depending on your internet connection..."
ollama pull llama3.2:3b

# Run setup wizard
echo ""
echo "⚙️  Running configuration wizard..."
npm run setup

# Ask about systemd service
echo ""
read -p "📋 Install as systemd service (auto-start on boot)? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # Update paths in service file
    CURRENT_DIR=$(pwd)
    sed -i "s|/home/pi/pi-assistant|$CURRENT_DIR|g" pi-assistant.service
    
    # Install service
    sudo cp pi-assistant.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable pi-assistant
    sudo systemctl start pi-assistant
    
    echo "✅ Service installed and started"
    echo ""
    echo "Service commands:"
    echo "  sudo systemctl status pi-assistant   # Check status"
    echo "  sudo systemctl restart pi-assistant  # Restart"
    echo "  sudo journalctl -u pi-assistant -f   # View logs"
else
    echo "Skipping service installation. Start manually with: npm start"
fi

echo ""
echo "✅ Installation complete!"
echo ""
echo "🚀 Next steps:"
echo "1. Message your Telegram bot to test it"
echo "2. Send /help for available commands"
echo "3. Wait for your morning briefing at 8 AM!"
echo ""
echo "📚 Check README.md for more information"
