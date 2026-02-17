# Pi Local Assistant - Project Overview

## What I Built for You

A complete local AI assistant application designed specifically for Raspberry Pi 5 with Ubuntu, using Ollama for local LLM processing. This app focuses on your exact requirements while being extensible for future business features.

## ✅ Implemented Features (Phase 1)

### 1. Chat via Telegram ✅
- Full bidirectional chat with your local LLM
- Natural language processing
- Conversation memory
- Multiple command support (/help, /tasks, /calendar, etc.)

### 2. Morning 8 AM Briefing ✅
Your daily briefing includes:
- 💰 Bitcoin price (real-time from Coinbase API)
- 📈 QQQ stock price with change % (Yahoo Finance)
- 📰 Business news headlines (placeholder - you can integrate NewsAPI)
- 🌤️ Local weather forecast (wttr.in - no API key needed)
- 📅 Today's calendar events from Google Calendar
- ✅ Daily tasks and reminders you've mentioned

### 3. Google Calendar Integration ✅
- View today's events
- View upcoming events
- Add new events
- Edit existing events
- Delete events
- OAuth 2.0 authentication

### 4. Task & Memory Management ✅
- Automatically extracts tasks from conversation
- Remembers things you tell it about
- Tracks due dates
- Persistent storage across restarts

## 🏗️ Architecture

```
Pi Local Assistant
├── Telegram Bot (node-telegram-bot-api)
│   ├── Command handling (/help, /tasks, /calendar)
│   └── Natural language conversation
│
├── Ollama Service (Local LLM)
│   ├── Chat with context
│   ├── Task extraction
│   └── Natural language understanding
│
├── Calendar Service (Google Calendar API)
│   ├── OAuth authentication
│   ├── Event CRUD operations
│   └── Schedule queries
│
├── Briefing Service
│   ├── Financial data (Bitcoin, stocks)
│   ├── Weather data
│   ├── News aggregation
│   └── Daily summary generation
│
└── Memory Service
    ├── Conversation history
    ├── Task tracking
    └── Persistent JSON storage
```

## 📁 Project Structure

```
pi-assistant/
├── src/
│   ├── index.js                 # Main entry point
│   ├── setup.js                 # Interactive setup wizard
│   └── services/
│       ├── ollama.js           # Ollama LLM integration
│       ├── telegram.js         # Telegram bot logic
│       ├── calendar.js         # Google Calendar API
│       ├── briefing.js         # Morning briefing generator
│       └── memory.js           # Task & conversation storage
├── config.json                  # Your configuration
├── config.example.json          # Example config
├── memory.json                  # Auto-generated persistent storage
├── package.json                 # Dependencies
├── install.sh                   # One-click installer
├── pi-assistant.service         # Systemd service file
├── README.md                    # Full documentation
├── QUICKSTART.md               # Quick setup guide
└── .gitignore                  # Git ignore rules
```

## 🚀 Installation Methods

### Method 1: Automated Install (Recommended)
```bash
cd ~/pi-assistant
chmod +x install.sh
./install.sh
```

This script:
- Checks for Node.js (installs if missing)
- Checks for Ollama (installs if missing)
- Installs npm dependencies
- Pulls recommended LLM model (llama3.2:3b)
- Runs configuration wizard
- Optionally installs systemd service

### Method 2: Manual Install
```bash
# 1. Install Ollama
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull model
ollama pull llama3.2:3b

# 3. Install dependencies
npm install

# 4. Run setup
npm run setup

# 5. Start
npm start
```

## 🎯 Usage Examples

### Telegram Commands
```
/start          - Welcome message
/help           - Show commands
/tasks          - View your tasks
/calendar       - Today's events
/clear          - Clear conversation memory
```

### Natural Language Examples
```
"Remind me to call John tomorrow"
→ Extracts task, saves with due date

"What's on my schedule today?"
→ Queries Google Calendar

"Add a meeting with Sarah Friday at 2pm"
→ Creates calendar event

"What's the weather like?"
→ Responds with local weather

"How is Bitcoin doing?"
→ In morning briefing
```

## ⚙️ Configuration

All settings in `config.json`:

```json
{
  "ollama": {
    "baseUrl": "http://localhost:11434",
    "model": "llama3.2:3b"
  },
  "telegram": {
    "botToken": "YOUR_TOKEN",
    "chatId": "YOUR_CHAT_ID"
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

## 🔮 Ready for Phase 2: Business Features

The architecture is designed to easily add your business requirements:

### Planned Features (You Can Add):

1. **Rent Payment Tracking**
   ```javascript
   // Add to briefing.js
   async getRentDueReminders() {
     // Check if rent due this month
     // Track payment status
     // Send reminders
   }
   ```

2. **Expense Management**
   ```javascript
   // New service: accounting.js
   class AccountingService {
     addExpense(amount, category, date) {}
     generateMonthlyReport() {}
     categorizeExpenses() {}
   }
   ```

3. **Invoice Management**
   ```javascript
   // Use Ollama to extract invoice data
   async processInvoice(imageOrPDF) {
     // OCR + LLM extraction
     // Store in database
     // Track payment status
   }
   ```

4. **Tenant Management**
   ```javascript
   class TenantService {
     addTenant(info) {}
     trackRentPayments() {}
     handleMaintenanceRequests() {}
   }
   ```

## 🔧 Key Technologies

- **Node.js** - Runtime
- **Ollama** - Local LLM inference
- **Telegram Bot API** - Messaging interface
- **Google Calendar API** - Schedule management
- **node-cron** - Scheduled tasks
- **axios** - HTTP requests
- **cheerio** - Optional web scraping

## 📊 Recommended Models for Pi 5

| Model | Size | RAM | Speed | Quality | Best For |
|-------|------|-----|-------|---------|----------|
| phi3:mini | 2.3GB | ~3GB | ⚡⚡⚡ | ⭐⭐ | Quick responses |
| llama3.2:3b | 2.0GB | ~3GB | ⚡⚡ | ⭐⭐⭐ | Balanced (recommended) |
| llama3.2:7b | 4.7GB | ~6GB | ⚡ | ⭐⭐⭐⭐ | Best quality |

## 🔒 Security Features

1. **Chat ID restriction** - Only responds to your Telegram
2. **Local processing** - All AI runs on your Pi
3. **No cloud dependencies** - Works offline (except external APIs)
4. **OAuth for Calendar** - Secure Google authentication
5. **Configuration excluded from git** - Secrets stay local

## 🐛 Debugging Tools

View logs:
```bash
# If running as service
sudo journalctl -u pi-assistant -f

# If running manually
npm start  # Logs to console
```

Check services:
```bash
systemctl status ollama
systemctl status pi-assistant
```

Test Ollama:
```bash
curl http://localhost:11434/api/tags
ollama list
```

## 📈 Performance Tips

1. **Model Selection**: Start with llama3.2:3b
2. **Swap Space**: Add 4GB swap if you have 4GB RAM Pi
3. **Conversation Length**: Auto-limited to last 100 messages
4. **Caching**: Ollama caches model in RAM after first use

## 🎉 What Makes This Different from OpenClaw

While inspired by OpenClaw, this is purpose-built for your needs:

1. ✅ **Simpler** - Focused on your 4 requirements
2. ✅ **Local-first** - Runs 100% on Pi with Ollama
3. ✅ **Lightweight** - No Electron, no desktop app
4. ✅ **Business-ready** - Easy to extend for accounting
5. ✅ **One platform** - Just Raspberry Pi + Ubuntu
6. ✅ **No subscription** - Truly free and local

## 🚦 Next Steps

1. **Test the basics**
   - Run `npm start`
   - Message your Telegram bot
   - Try /help, /tasks, /calendar

2. **Wait for morning briefing**
   - Scheduled for 8 AM (configurable)
   - Tests all integrations

3. **Add business features**
   - Start with rent tracking
   - Expand to invoices
   - Build accounting features

4. **Customize**
   - Add more stocks to track
   - Integrate better news APIs
   - Add voice interface (future)

## 📚 Documentation

- `README.md` - Comprehensive documentation
- `QUICKSTART.md` - Fast setup guide
- `config.example.json` - Configuration reference
- Code comments - Throughout all files

## 💡 Pro Tips

1. Keep Ollama updated: `curl -fsSL https://ollama.com/install.sh | sh`
2. Monitor RAM: `htop` or `free -h`
3. Back up memory.json: Contains all your tasks
4. Use systemd service: Auto-restart on failures
5. Check logs regularly: Catch issues early

---

Built specifically for Raspberry Pi 5 with local AI processing 🤖

Ready to run, easy to extend, fully yours to customize!
