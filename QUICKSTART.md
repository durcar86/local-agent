# Quick Start Guide 🚀

Get your Pi Local Assistant running in minutes!

## Prerequisites

- Raspberry Pi 5 with Ubuntu 24.04
- Internet connection
- Telegram account

## Installation (One-Line)

```bash
cd ~ && git clone <your-repo> pi-assistant && cd pi-assistant && chmod +x install.sh && ./install.sh
```

Or step by step:

## Step-by-Step Installation

### 1. Install Ollama (if not already installed)

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable ollama
sudo systemctl start ollama
```

### 2. Pull an LLM Model

```bash
# Recommended for Pi 5
ollama pull llama3.2:3b

# OR for faster but less capable
ollama pull phi3:mini
```

### 3. Setup the Assistant

```bash
cd ~/pi-assistant
npm install
npm run setup
```

Follow the prompts to configure:
- Telegram bot token
- Your Telegram chat ID
- Briefing time
- Location for weather
- Stocks/crypto to track

### 4. Get Telegram Credentials

#### Get Bot Token:
1. Open Telegram
2. Message [@BotFather](https://t.me/BotFather)
3. Send `/newbot`
4. Follow prompts to create bot
5. Copy the bot token (looks like: `1234567890:ABCdefGHI...`)

#### Get Your Chat ID:
1. Message your new bot (send any message)
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for `"chat":{"id":123456789`
4. Copy the number after `"id":`

### 5. Start the Assistant

#### Manual Start:
```bash
npm start
```

#### Or Install as Service (auto-start on boot):
```bash
sudo cp pi-assistant.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable pi-assistant
sudo systemctl start pi-assistant
```

Check status:
```bash
sudo systemctl status pi-assistant
sudo journalctl -u pi-assistant -f  # View logs
```

## Testing

1. Message your Telegram bot: "Hello!"
2. Try commands:
   - `/help` - See all commands
   - `/tasks` - View tasks
   - "Remind me to buy milk tomorrow"
   - "What's the weather?"

## Optional: Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create project → Enable Calendar API
3. Create OAuth credentials (Desktop app)
4. Download `credentials.json` to project directory
5. Restart assistant - it will prompt for authorization

## Troubleshooting

### Ollama not working?
```bash
systemctl status ollama
sudo systemctl restart ollama
ollama list  # Check available models
```

### Bot not responding?
1. Check config.json has correct bot token
2. Verify chatId matches your Telegram
3. Check logs: `sudo journalctl -u pi-assistant -f`

### Need to change settings?
```bash
nano config.json  # Edit directly
# OR
npm run setup     # Run wizard again
```

## Performance Tips for Pi 5

- Use `llama3.2:3b` for best balance
- Use `phi3:mini` if you need speed
- Avoid `7b` or larger models unless you have 8GB RAM
- Add swap if memory is tight:
  ```bash
  sudo fallocate -l 4G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  ```

## What's Next?

Once running, your assistant will:
- ✅ Respond to Telegram messages
- ✅ Send morning briefings at 8 AM with:
  - Bitcoin & stock prices
  - Weather forecast
  - Calendar events
  - Daily tasks
- ✅ Remember tasks you mention
- ✅ Help with calendar management

Enjoy your local AI assistant! 🎉
