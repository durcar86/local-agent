import { readFileSync, writeFileSync } from 'fs';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('🚀 Pi Local Assistant Setup\n');
  console.log('This wizard will help you configure your assistant.\n');

  const config = {
    ollama: {},
    telegram: {},
    googleCalendar: {
      credentialsPath: './credentials.json',
      tokenPath: './token.json'
    },
    briefing: {},
    location: {},
    finance: {}
  };

  // Ollama configuration
  console.log('📡 Ollama Configuration');
  config.ollama.baseUrl = await question('Ollama URL (default: http://localhost:11434): ') || 'http://localhost:11434';
  config.ollama.model = await question('Ollama model (default: llama3.2:3b): ') || 'llama3.2:3b';
  console.log('');

  // Telegram configuration
  console.log('📱 Telegram Configuration');
  console.log('To get a bot token, message @BotFather on Telegram and create a new bot.');
  config.telegram.botToken = await question('Telegram Bot Token: ');
  console.log('\nTo get your chat ID, message your bot, then visit:');
  console.log(`https://api.telegram.org/bot${config.telegram.botToken}/getUpdates`);
  config.telegram.chatId = await question('Your Telegram Chat ID: ');
  console.log('');

  // Briefing configuration
  console.log('⏰ Morning Briefing Configuration');
  config.briefing.time = await question('Briefing time (HH:MM format, default: 08:00): ') || '08:00';
  config.briefing.timezone = await question('Timezone (default: America/New_York): ') || 'America/New_York';
  console.log('');

  // Location configuration
  console.log('🌍 Location Configuration (for weather)');
  config.location.city = await question('City (default: New York): ') || 'New York';
  config.location.country = await question('Country code (default: US): ') || 'US';
  console.log('');

  // Finance configuration
  console.log('💰 Finance Configuration');
  const stocksInput = await question('Stock symbols to track (comma-separated, default: QQQ,SPY): ') || 'QQQ,SPY';
  config.finance.stocks = stocksInput.split(',').map(s => s.trim());
  
  const cryptoInput = await question('Cryptocurrencies to track (comma-separated, default: BTC): ') || 'BTC';
  config.finance.crypto = cryptoInput.split(',').map(c => c.trim());
  console.log('');

  // Google Calendar
  console.log('📅 Google Calendar Configuration');
  console.log('Calendar integration is optional. To enable:');
  console.log('1. Go to Google Cloud Console: https://console.cloud.google.com/');
  console.log('2. Create a new project or select existing');
  console.log('3. Enable Google Calendar API');
  console.log('4. Create OAuth 2.0 credentials (Desktop app)');
  console.log('5. Download credentials.json and place it in this directory');
  console.log('');
  const enableCalendar = await question('Enable Google Calendar? (y/n, default: n): ');
  
  if (enableCalendar.toLowerCase() === 'y') {
    console.log('Make sure credentials.json is in the project directory.');
    console.log('On first run, you\'ll be prompted to authorize the app.\n');
  }

  // Save configuration
  writeFileSync('./config.json', JSON.stringify(config, null, 2));
  console.log('✅ Configuration saved to config.json\n');

  // Additional setup instructions
  console.log('📝 Next Steps:\n');
  console.log('1. Make sure Ollama is running:');
  console.log('   systemctl --user start ollama');
  console.log('   OR: ollama serve\n');
  
  console.log('2. Pull the LLM model:');
  console.log(`   ollama pull ${config.ollama.model}\n`);
  
  console.log('3. Install dependencies:');
  console.log('   npm install\n');
  
  console.log('4. Start the assistant:');
  console.log('   npm start\n');
  
  console.log('💡 Tips:');
  console.log('   - Send /help to your Telegram bot for commands');
  console.log('   - Morning briefings will be sent at', config.briefing.time);
  console.log('   - Tell your assistant about tasks and it will remember them');
  console.log('   - Ask about your schedule to see calendar events\n');

  rl.close();
}

setup().catch(error => {
  console.error('Setup error:', error);
  rl.close();
  process.exit(1);
});
