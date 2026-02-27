# Pi Local Assistant 🤖

A personal AI assistant running locally on Raspberry Pi 5 with Ollama, featuring Telegram integration, morning briefings, and Google Calendar management.

## Features ✨

- 💬 **Chat via Telegram** - Natural conversation with your local LLM
- 🌅 **Morning Briefings** - Automated 8 AM messages with:
  - Bitcoin and stock market prices (QQQ, etc.)
  - Latest business news headlines
  - Local weather forecast
  - Daily tasks and reminders
  - Today's calendar events
- 📅 **Google Calendar Integration** - Add, view, and manage calendar events
- 🧠 **Memory & Tasks** - Remembers conversations and tracks your to-dos
- 🏠 **100% Local** - Runs entirely on your Raspberry Pi using Ollama

## Prerequisites 📋

### Hardware
- Raspberry Pi 5 (8GB recommended)
- MicroSD card (64GB+ recommended)
- Stable internet connection

### Software
- Ubuntu 24.04 LTS for Raspberry Pi
- Node.js 18+ 
- Ollama installed and running

## Installation 🚀

### 1. Install Ollama on Raspberry Pi

```bash
# Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Start Ollama service
sudo systemctl enable ollama
sudo systemctl start ollama

# Verify Ollama is running
curl http://localhost:11434/api/tags
```

### 2. Pull a Compatible LLM Model

For Raspberry Pi 5, recommended models:

```bash
# Smaller, faster model (recommended for Pi)
ollama pull llama3.2:3b

# OR larger, more capable model (needs 8GB RAM)
ollama pull llama3.2:7b

# OR tiny model for testing
ollama pull phi3:mini
```

### 3. Clone and Setup the Assistant

```bash
# Clone or download this project
cd ~
git clone <your-repo-url> pi-assistant
cd pi-assistant

# Install dependencies
npm install

# Run setup wizard
npm run setup
```

### 4. Configure Telegram Bot

1. Open Telegram and message [@BotFather](https://t.me/BotFather)
2. Create a new bot with `/newbot`
3. Save the bot token
4. Message your new bot
5. Get your chat ID by visiting:
   ```
   https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates
   ```
6. Look for `"chat":{"id":123456789` in the response

### 5. (Optional) Setup Google Calendar

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable the Google Calendar API
4. Create OAuth 2.0 credentials (Desktop application)
5. Download `credentials.json` to the project directory (/data/pi-assistant)
6. Run script, bash /scripts/google-auth.sh and copy token from URL redirect link

## Configuration ⚙️

Edit `config.json`:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2:3b"
  },
  "telegram": {
    "botToken": "YOUR_BOT_TOKEN",
    "chatId": "YOUR_CHAT_ID"
  },
  "googleCalendar": {
    "credentialsPath": "./credentials.json",
    "tokenPath": "./token.json"
  },
  "briefing": {
    "time": "08:00",
    "timezone": "America/New_York"
  },
  "location": {
    "city": "New York",
    "country": "US"
  },
  "finance": {
    "stocks": ["QQQ", "SPY"],
    "crypto": ["BTC"]
  }
}
```

## Usage 🎯

### Start the Assistant

```bash
npm start
```

### Running as a Service (Auto-start on boot)

Create a systemd service:

```bash
sudo nano /etc/systemd/system/pi-assistant.service
```

Add this content:

```ini
[Unit]
Description=Pi Local Assistant
After=network.target ollama.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/pi-assistant
ExecStart=/usr/bin/node /home/pi/pi-assistant/src/index.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable pi-assistant
sudo systemctl start pi-assistant
sudo systemctl status pi-assistant
```

View logs:

```bash
sudo journalctl -u pi-assistant -f
```

### Telegram Commands

- `/start` - Welcome message
- `/help` - Show available commands
- `/tasks` - View your tasks and reminders
- `/calendar` - View today's calendar events
- `/clear` - Clear conversation memory

### Natural Language Features

Just talk naturally to your assistant:

- "Remind me to call John tomorrow"
- "What's on my calendar today?"
- "Add a meeting with Sarah on Friday at 2pm"
- "What's the weather like?"
- "How is the stock market doing?"

## Architecture 🏗️

```
pi-assistant/
├── src/
│   ├── index.js              # Main application entry
│   ├── setup.js              # Interactive setup wizard
│   └── services/
│       ├── ollama.js         # Ollama LLM integration
│       ├── telegram.js       # Telegram bot handler
│       ├── calendar.js       # Google Calendar API
│       ├── briefing.js       # Morning briefing generator
│       └── memory.js         # Task & conversation storage
├── config.json               # Configuration file
├── memory.json               # Persistent memory storage
├── package.json              # Dependencies
└── README.md                 # This file
```

## Future Enhancements 🔮

Based on your requirements, here are planned features:

### Phase 2: Business Administration
- [ ] Rent payment tracking and reminders
- [ ] Expense categorization and reporting
- [ ] Invoice management
- [ ] Receipt scanning and storage
- [ ] Financial summaries

### Phase 3: Advanced Features
- [ ] Voice interaction (using local STT/TTS)
- [ ] Email integration (Gmail, Outlook)
- [ ] Document scanning and OCR
- [ ] Smart home integration
- [ ] Multi-user support

## Troubleshooting 🔧

### Ollama Not Responding

```bash
# Check if Ollama is running
systemctl status ollama

# Restart Ollama
sudo systemctl restart ollama

# Check logs
journalctl -u ollama -f
```

### Model Not Found

```bash
# List available models
ollama list

# Pull the model
ollama pull llama3.2:3b
```

### Telegram Bot Not Responding

1. Check bot token is correct in `config.json`
2. Verify chat ID matches your Telegram account
3. Ensure bot is started: look for "Telegram bot started" in logs

### Calendar Authorization Issues

1. Delete `token.json`
2. Restart the app
3. Follow the authorization URL
4. Complete OAuth flow

### Performance Issues on Pi

If the assistant is slow:

1. Use a smaller model: `ollama pull phi3:mini`
2. Reduce context window in Ollama
3. Add swap space:
   ```bash
   sudo fallocate -l 4G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

## Model Recommendations for Pi 5 📊

| Model | Size | RAM Usage | Speed | Quality |
|-------|------|-----------|-------|---------|
| phi3:mini | 2.3GB | ~3GB | ⚡⚡⚡ | ⭐⭐ |
| llama3.2:3b | 2.0GB | ~3GB | ⚡⚡ | ⭐⭐⭐ |
| llama3.2:7b | 4.7GB | ~6GB | ⚡ | ⭐⭐⭐⭐ |

## Security Considerations 🔒

- Keep your `config.json` secure (contains API keys)
- Never commit `config.json` to version control
- Use environment variables for sensitive data in production
- Restrict Telegram bot to your chat ID only
- Enable Google Calendar API only for your account

## Contributing 🤝

Contributions welcome! Areas that need work:

- Better news integration (NewsAPI, RSS feeds)
- Voice interface using Whisper + Piper
- Web dashboard for configuration
- Multi-language support
- Plugin system for extensions

## License 📄

MIT License - feel free to use and modify!

## Acknowledgments 🙏

- Built with inspiration from [OpenClaw](https://github.com/openclaw/openclaw)
- Powered by [Ollama](https://ollama.com/)
- Uses [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api)
- Google Calendar integration via [googleapis](https://github.com/googleapis/google-api-nodejs-client)

## Support 💬

If you run into issues:

1. Check the troubleshooting section
2. Review the logs: `sudo journalctl -u pi-assistant -f`
3. Ensure all services are running
4. Verify your configuration

---

Built with ❤️ for Raspberry Pi 5 running Ubuntu
