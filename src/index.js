import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { readFileSync } from 'fs';
import { OllamaService } from './services/ollama.js';
import { TelegramService } from './services/telegram.js';
import { CalendarService } from './services/calendar.js';
import { BriefingService } from './services/briefing.js';
import { MemoryService } from './services/memory.js';
import { TenantService } from './services/tenant.js';
import { WeatherService } from './services/weather.js';
import { ContextService } from './services/context.js';
import { BillsService } from './services/bills.js';

// Load configuration
const config = JSON.parse(readFileSync('./config.json', 'utf-8'));

// Initialize services
const ollama = new OllamaService(config.ollama);
const memory = new MemoryService();
const calendar = new CalendarService(config.googleCalendar);
const bills = new BillsService();
const tenant = new TenantService();
const briefing = new BriefingService(config, ollama, calendar, tenant, bills);
const weather = new WeatherService(config);
const context = new ContextService(config);
const telegram = new TelegramService(config.telegram, ollama, calendar, memory, tenant, weather, briefing, context, bills);

console.log('🤖 Pi Local Assistant Starting...');
console.log(`📡 Ollama: ${config.ollama.baseUrl}`);
console.log(`🤖 Model: ${config.ollama.model}`);
console.log(`⏰ Briefing Time: ${config.briefing.time}`);

// Schedule morning briefing
const [hour, minute] = config.briefing.time.split(':');
cron.schedule(`${minute} ${hour} * * *`, async () => {
  console.log('⏰ Running morning briefing...');
  try {
    const briefingMessage = await briefing.generateMorningBriefing();
    await telegram.sendMessage(briefingMessage);
    console.log('✅ Morning briefing sent!');
  } catch (error) {
    console.error('❌ Error sending briefing:', error.message);
  }
});

// Start Telegram bot
telegram.start();

console.log('✅ Assistant is running!');
console.log('💬 Send a message on Telegram to interact with your assistant');
console.log('📅 Say things like "remind me to X tomorrow" to add tasks');
console.log('⏰ Morning briefing scheduled for', config.briefing.time);

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down gracefully...');
  telegram.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n👋 Shutting down gracefully...');
  telegram.stop();
  process.exit(0);
});