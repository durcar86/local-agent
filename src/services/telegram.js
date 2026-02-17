import TelegramBot from 'node-telegram-bot-api';

export class TelegramService {
  constructor(config, ollamaService, calendarService, memoryService, tenantService, weatherService, BriefingService, contextService, billsService) {
    this.config = config;
    this.ollama = ollamaService;
    this.calendar = calendarService;
    this.memory = memoryService;
    this.tenant = tenantService;
    this.weather = weatherService;
    this.briefing = BriefingService;
    this.context = contextService;
    this.bills = billsService;
    this.bot = new TelegramBot(config.botToken, { polling: true });
    this.chatId = config.chatId;
  }

  start() {
    console.log('📱 Telegram bot started');

    // Handle all messages
    this.bot.on('message', async (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;
    
      if (this.chatId && chatId.toString() !== this.chatId) {
        console.log(`⚠️  Unauthorized access attempt from chat ${chatId}`);
        return;
      }
    
      console.log(`📨 Message from ${chatId}: ${text}`);
    
      // Show typing immediately
      await this.sendTyping(chatId);
    
      try {
        if (text.startsWith('/')) {
          await this.handleCommand(chatId, text);
          return;
        }
    
        // Save conversation to memory
        this.memory.addMessage('user', text);
    
        // Use sendTypingWhile for all intent processing
        await this.sendTypingWhile(chatId, async () => {
          
          // Check for check writing intent FIRST
          const checkIntent = await this.ollama.extractCheckIntent(text);
          if (checkIntent.action === 'write_check') {
            await this.handleCheckRequest(chatId, checkIntent);
            return;
          }
    
          // Check for payment recording
          const paymentIntent = await this.ollama.extractPaymentIntent(text);
          if (paymentIntent.action === 'payment') {
            await this.handlePaymentRecord(chatId, paymentIntent);
            return;
          }
    
          if (await this.isMathQuestion(text)) {
            // Fall through to LLM
          } else {
            // Check for bill intent
            const billIntent = await this.ollama.extractBillIntent(text);
            if (billIntent.action !== 'none') {
              await this.handleBillIntent(chatId, billIntent);
              return;
            }
    
            // Check for upcoming expense intent
            const upcomingIntent = await this.ollama.extractUpcomingExpenseIntent(text);
            if (upcomingIntent.action !== 'none') {
              await this.handleUpcomingExpenseIntent(chatId, upcomingIntent);
              return;
            }
    
            // Check for weather questions
            if (await this.detectWeatherIntent(text)) {
              await this.handleWeatherQuery(chatId, text);
              return;
            }
    
            // Check for calendar intent
            const calendarIntent = await this.ollama.extractCalendarIntent(text);
            if (calendarIntent.action !== 'none') {
              await this.handleCalendarIntent(chatId, text, calendarIntent);
              return;
            }
    
            // Check for rent reminder questions
            if (await this.ollama.detectRentReminderIntent(text)) {
              const summary = this.tenant.getRentReminderSummary();
              await this.bot.sendMessage(chatId, summary);
              return;
            }
    
            // Check for tenant management intent
            const tenantIntent = await this.ollama.extractTenantIntent(text);
            if (tenantIntent.action !== 'none') {
              await this.handleTenantIntent(chatId, tenantIntent);
              return;
            }
    
            // Check for tasks/reminders
            const tasks = await this.ollama.extractTaskIntent(text);
            if (tasks.length > 0) {
              console.log('📋 Tasks detected:', tasks);
              for (const task of tasks) {
                this.memory.addTask(task);
              }
              await this.bot.sendMessage(chatId,
                `✅ Got it! I'll remember: ${tasks.map(t => t.task).join(', ')}`
              );
              return;
            }
          }
    
          // Generate LLM response
          const conversationHistory = this.memory.getRecentMessages(10);
          const contextualPrompt = this.context.buildContextualSystemPrompt();
    
          const messages = [
            {
              role: 'system',
              content: contextualPrompt
            },
            ...conversationHistory.map(m => ({
              role: m.role,
              content: m.content
            }))
          ];
    
          const response = await this.ollama.chat(messages);
          this.memory.addMessage('assistant', response.content);
          await this.bot.sendMessage(chatId, response.content);
        });
    
      } catch (error) {
        console.error('Error handling message:', error);
        await this.bot.sendMessage(chatId,
          '❌ Sorry, I encountered an error processing your message.'
        );
      }
    });

    // Handle errors
    this.bot.on('error', (error) => {
      console.error('Telegram bot error:', error);
    });

    this.bot.on('polling_error', (error) => {
      console.error('Telegram polling error:', error);
    });
  }

  async detectRentReminderIntent(message) {
    const keywords = [
      'rent reminder',
      'tenant reminder',
      'send rent',
      'message tenant',
      'rent due',
      'tell me about rent',
      'any rent reminders',
      'rent payment',
      'remind tenant'
    ];
    
    const lowerMsg = message.toLowerCase();
    
    // Must be an explicit question about rent/tenants
    const hasRentKeyword = keywords.some(keyword => lowerMsg.includes(keyword));
    const isTenantQuestion = lowerMsg.includes('tenant') && 
                            (lowerMsg.includes('?') || 
                             lowerMsg.includes('rent') ||
                             lowerMsg.includes('payment') ||
                             lowerMsg.includes('remind'));
    
    return hasRentKeyword || isTenantQuestion;
  }

  async isMathQuestion(message) {
    const lowerMsg = message.toLowerCase();
    
    // Math indicators
    const mathKeywords = [
      'calculate',
      'what is',
      'what\'s',
      'how much is',
      'multiply',
      'divide',
      'subtract',
      'minus',
      'times',
      'plus'
    ];
    
    // Math operators
    const hasMathOperators = /[\+\-\*\/\%]/.test(message) || 
                            message.includes('×') || 
                            message.includes('÷');
    
    // Check for percentage calculations
    const hasPercentage = message.includes('%');
    
    // If it has math operators or percentage, it's math
    if (hasMathOperators || hasPercentage) {
      return true;
    }
    
    // If it has math keywords but NO calendar keywords
    const hasMathKeyword = mathKeywords.some(kw => lowerMsg.includes(kw));
    const hasCalendarKeyword = lowerMsg.includes('calendar') || 
                               lowerMsg.includes('schedule') ||
                               lowerMsg.includes('meeting') ||
                               lowerMsg.includes('appointment');
    
    return hasMathKeyword && !hasCalendarKeyword;
  }

  async detectWeatherIntent(message) {
    const weatherKeywords = [
      'weather',
      'temperature', 
      'how hot',
      'how cold',
      'forecast',
      'raining',
      'rain',
      'sunny',
      'umbrella',
      'jacket'
    ];
    
    const lowerMsg = message.toLowerCase();
    
    // Must contain weather keyword AND be a question or request
    const hasWeatherKeyword = weatherKeywords.some(keyword => lowerMsg.includes(keyword));
    const isQuestion = lowerMsg.includes('?') || 
                      lowerMsg.startsWith('what') || 
                      lowerMsg.startsWith('how') ||
                      lowerMsg.startsWith('is it') ||
                      lowerMsg.startsWith('will it') ||
                      lowerMsg.startsWith('should i');
    
    return hasWeatherKeyword && (isQuestion || lowerMsg.includes('tell me'));
  }

  async extractTenantIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Quick keyword check first
    const tenantKeywords = ['tenant', 'rent', 'renter', 'lease'];
    const hasTenantKeyword = tenantKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasTenantKeyword) {
      return { action: 'none' };
    }
  
    const prompt = `Analyze this message for tenant/property management intent. Return ONLY a JSON object:
  
  {
    "action": "add|list|reminder|payment|update|none",
    "tenantName": "name or null",
    "phone": "phone number or null",
    "rentAmount": "amount as number or null",
    "unit": "unit/property or null",
    "paymentMethod": "method or null"
  }
  
  Examples:
  "Add tenant John Smith, rent $1200, phone 555-1234" -> {"action":"add","tenantName":"John Smith","phone":"555-1234","rentAmount":1200,"unit":null,"paymentMethod":null}
  "List my tenants" -> {"action":"list","tenantName":null,"phone":null,"rentAmount":null,"unit":null,"paymentMethod":null}
  "Send rent reminder" -> {"action":"reminder","tenantName":null,"phone":null,"rentAmount":null,"unit":null,"paymentMethod":null}
  "John paid rent" -> {"action":"payment","tenantName":"John","phone":null,"rentAmount":null,"unit":null,"paymentMethod":null}
  "Do I have any rent reminders?" -> {"action":"reminder","tenantName":null,"phone":null,"rentAmount":null,"unit":null,"paymentMethod":null}
  
  IMPORTANT: Only return tenant actions for actual tenant/rent management. General questions should return "none".
  
  User message: "${message}"
  
  JSON object:`;
  
    const response = await this.generate(prompt);
    
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { action: 'none' };
    } catch (error) {
      console.error('Failed to parse tenant intent:', error.message);
      return { action: 'none' };
    }
  }
  
  async extractTaskIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Quick keyword check
    const taskKeywords = ['remind me', 'remember', 'don\'t forget', 'task', 'todo', 'to do'];
    const hasTaskKeyword = taskKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasTaskKeyword) {
      return [];
    }
  
    const prompt = `Extract tasks or reminders from this message. Return ONLY a JSON array:
  
  [{"task": "description", "dueDate": "YYYY-MM-DD or null"}]
  
  Examples:
  "Remind me to call John tomorrow" -> [{"task":"call John","dueDate":"2024-02-14"}]
  "Don't forget to buy milk and eggs" -> [{"task":"buy milk","dueDate":null},{"task":"buy eggs","dueDate":null}]
  "Remember I have a dentist appointment Friday" -> [{"task":"dentist appointment","dueDate":"2024-02-16"}]
  "Task: finish the report by Monday" -> [{"task":"finish the report","dueDate":"2024-02-19"}]
  
  IMPORTANT: Only extract actual tasks/reminders. Questions or statements without actionable tasks should return empty array [].
  
  Today is ${new Date().toISOString().split('T')[0]}.
  User message: "${message}"
  
  JSON array:`;
  
    const response = await this.generate(prompt);
    
    try {
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const tasks = JSON.parse(jsonMatch[0]);
        
        // Process relative dates
        return tasks.map(task => {
          if (task.dueDate === 'tomorrow') {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            task.dueDate = tomorrow.toISOString().split('T')[0];
          }
          return task;
        });
      }
      return [];
    } catch (error) {
      console.error('Failed to parse task intent:', error.message);
      return [];
    }
  }

  async extractCalendarIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Calendar-specific keywords that indicate calendar intent
    const calendarKeywords = [
      'calendar',
      'schedule',
      'meeting',
      'appointment',
      'event',
      'remind me',
      'add to calendar',
      'what do i have',
      "what's on my",
      'free time',
      'busy'
    ];
    
    // Check if message contains calendar keywords
    const hasCalendarKeyword = calendarKeywords.some(keyword => lowerMsg.includes(keyword));
    
    // If no calendar keywords, don't even try to extract intent
    if (!hasCalendarKeyword) {
      return { action: 'none' };
    }
    
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Analyze this message for calendar-related intent. Return ONLY a JSON object with this exact format:
  
  {
    "action": "view|add|edit|delete|none",
    "when": "today|tomorrow|YYYY-MM-DD|null",
    "summary": "event title or null",
    "time": "HH:MM or null",
    "duration": "minutes as number or null",
    "details": "additional notes or null"
  }
  
  Examples:
  "What's on my calendar tomorrow?" -> {"action":"view","when":"tomorrow","summary":null,"time":null,"duration":null,"details":null}
  "Add meeting with John at 2pm Friday" -> {"action":"add","when":"2024-01-19","summary":"Meeting with John","time":"14:00","duration":60,"details":null}
  "Schedule dentist appointment next Tuesday 3:30pm" -> {"action":"add","when":"2024-01-23","summary":"Dentist appointment","time":"15:30","duration":60,"details":null}
  "What do I have today?" -> {"action":"view","when":"today","summary":null,"time":null,"duration":null,"details":null}
  
  IMPORTANT: Only return calendar actions for actual calendar-related requests. Math questions, calculations, or "add" in other contexts should return "none".
  
  Today's date is ${today}. User message: "${message}"
  
  JSON object:`;
  
    const response = await this.generate(prompt);
    
    try {
      // Try to extract JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const intent = JSON.parse(jsonMatch[0]);
        
        // Convert relative dates to actual dates
        if (intent.when === 'today') {
          intent.when = new Date().toISOString().split('T')[0];
        } else if (intent.when === 'tomorrow') {
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          intent.when = tomorrow.toISOString().split('T')[0];
        }
        
        return intent;
      }
      return { action: 'none' };
    } catch (error) {
      console.error('Failed to parse calendar intent:', error.message);
      return { action: 'none' };
    }
  }

  async detectTenantIntent(text) {
    // Simple keyword matching for tenant operations
    const lower = text.toLowerCase();
    
    if (lower.includes('add tenant') || lower.includes('new tenant')) {
      return { action: 'add', text: text };
    }
    
    if (lower.includes('rent reminder') || lower.includes('send rent reminder')) {
      return { action: 'reminder', text: text };
    }
    
    if (lower.includes('list tenants') || lower.includes('show tenants')) {
      return { action: 'list', text: text };
    }
    
    if (lower.includes('payment received') || lower.includes('rent paid')) {
      return { action: 'payment', text: text };
    }
    
    return { action: 'none' };
  }

  async handleBillIntent(chatId, intent) {
    console.log('💵 Bill intent detected:', intent);
  
    try {
      switch (intent.action) {
        case 'list':
          await this.handleListBills(chatId);
          break;
        
        case 'check_due':
          await this.handleCheckDueBills(chatId, intent.timeframe);
          break;
        
        case 'pay':
          await this.handleRecordBillPayment(chatId, intent);
          break;
        
        case 'cashflow':
          await this.handleCashflowCheck(chatId, intent.timeframe);
          break;
        
        default:
          await this.bot.sendMessage(chatId,
            '💡 I can help you with:\n' +
            '• "List my bills"\n' +
            '• "What bills are due today?"\n' +
            '• "I paid [bill name]"\n' +
            '• "Do I have enough to pay today\'s bills?"'
          );
      }
    } catch (error) {
      console.error('Bill intent error:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I had trouble with that bill request.');
    }
  }
  
  async handleListBills(chatId) {
    const allBills = this.bills.getAllActiveBills();
    
    if (allBills.total === 0) {
      await this.bot.sendMessage(chatId,
        '📋 No bills found.\n\n' +
        'Use /addbill to add your first bill!'
      );
      return;
    }
  
    let message = '📋 Your Bills:\n\n';
  
    if (allBills.recurring.length > 0) {
      message += '🔄 Recurring Bills:\n';
      allBills.recurring.forEach(bill => {
        const amountStr = bill.isVariable ? 'Variable' : `$${bill.amount.toFixed(2)}`;
        const autopayStr = bill.autopay ? '✅ Autopay' : '⚠️ Manual';
        message += `  • ${bill.name}\n`;
        message += `    💰 ${amountStr} | Due: ${bill.dueDay}th | ${autopayStr}\n`;
      });
      message += '\n';
    }
  
    if (allBills.onetime.length > 0) {
      message += '📅 One-Time Bills:\n';
      allBills.onetime.forEach(bill => {
        message += `  • ${bill.name}\n`;
        message += `    💰 $${bill.amount.toFixed(2)} | Due: ${bill.dueDate}\n`;
      });
      message += '\n';
    }
  
    const monthlyTotal = this.bills.getMonthlyTotal();
    message += `📊 Estimated Monthly Total: $${monthlyTotal.toFixed(2)}`;
  
    await this.bot.sendMessage(chatId, message);
  }

  async handleListUpcomingExpenses(chatId) {
    const summary = this.bills.getUpcomingExpensesSummary();
    
    if (!summary) {
      await this.bot.sendMessage(chatId,
        '📋 No upcoming expenses found.\n\n' +
        'Add one by telling me:\n' +
        '"Add upcoming expense: Lawn Care $850 due March 15"'
      );
      return;
    }

    let message = '📋 Upcoming Expenses:\n\n';

    if (summary.urgent.length > 0) {
      message += '🔴 Due Within 30 Days:\n';
      summary.urgent.forEach(expense => {
        const statusIcon = expense.percentReserved >= 100 ? '✅' :
                          expense.percentReserved >= 50 ? '🟡' : '🔴';
        const dueDate = new Date(expense.dueDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric'
        });
        message += `  ${statusIcon} ${expense.name}\n`;
        message += `     💰 $${expense.amount.toFixed(2)} | Due: ${dueDate} (${expense.daysUntilDue} days)\n`;
        if (expense.currentlyReserved > 0) {
          message += `     💵 Reserved: $${expense.currentlyReserved.toFixed(2)} (${expense.percentReserved.toFixed(0)}%)\n`;
          if (expense.stillNeeded > 0) {
            message += `     ⚠️ Still Need: $${expense.stillNeeded.toFixed(2)}\n`;
          }
        } else {
          message += `     ⚠️ Nothing reserved yet\n`;
        }
      });
      message += '\n';
    }

    if (summary.upcoming.length > 0) {
      message += '🟡 Due in 31-90 Days:\n';
      summary.upcoming.forEach(expense => {
        const dueDate = new Date(expense.dueDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric'
        });
        message += `  • ${expense.name}\n`;
        message += `    💰 $${expense.amount.toFixed(2)} | Due: ${dueDate} (${expense.daysUntilDue} days)\n`;
        if (expense.currentlyReserved > 0) {
          message += `    💵 Reserved: $${expense.currentlyReserved.toFixed(2)} (${expense.percentReserved.toFixed(0)}%)\n`;
        }
      });
      message += '\n';
    }

    if (summary.future.length > 0) {
      message += '📅 Future (90+ Days):\n';
      summary.future.forEach(expense => {
        const dueDate = new Date(expense.dueDate).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        });
        message += `  • ${expense.name} - $${expense.amount.toFixed(2)} | Due: ${dueDate}\n`;
      });
      message += '\n';
    }

    message += `━━━━━━━━━━━━━━━━━━━━\n`;
    message += `📊 Total Outstanding: $${summary.totalAmount.toFixed(2)}\n`;
    if (summary.totalReserved > 0) {
      message += `💵 Total Reserved: $${summary.totalReserved.toFixed(2)}\n`;
    }
    if (summary.totalStillNeeded > 0) {
      message += `⚠️ Total Still Needed: $${summary.totalStillNeeded.toFixed(2)}`;
    }

    await this.bot.sendMessage(chatId, message);
  }

  async handleReserveFunds(chatId, intent) {
    if (!intent.expenseName) {
      await this.bot.sendMessage(chatId,
        '❓ Which expense are you reserving funds for?\n\n' +
        'Example: "Reserve $500 for lawn care"'
      );
      return;
    }

    const expense = this.bills.getUpcomingExpenseByName(intent.expenseName);

    if (!expense) {
      const summary = this.bills.getUpcomingExpensesSummary();
      let expenseList = 'No upcoming expenses found.';
      if (summary) {
        const all = [...summary.urgent, ...summary.upcoming, ...summary.future];
        expenseList = all.map(e => `• ${e.name}`).join('\n');
      }
      await this.bot.sendMessage(chatId,
        `❌ Could not find "${intent.expenseName}".\n\n` +
        `Your upcoming expenses:\n${expenseList}`
      );
      return;
    }

    if (!intent.amount) {
      await this.bot.sendMessage(chatId,
        `💰 How much are you reserving for ${expense.name}?\n\n` +
        `Currently reserved: $${expense.currentlyReserved.toFixed(2)}\n` +
        `Total needed: $${expense.amount.toFixed(2)}`
      );
      return;
    }

    const updated = this.bills.reserveFunds(expense.id, intent.amount);
    const percent = Math.min(100, (updated.currentlyReserved / updated.amount * 100)).toFixed(0);
    const progressBar = this.generateProgressBar(parseFloat(percent));
    const stillNeeded = updated.amount - updated.currentlyReserved;

    let message = `✅ Funds Reserved!\n\n`;
    message += `📋 ${updated.name}\n`;
    message += `💰 Added: $${intent.amount.toFixed(2)}\n`;
    message += `${progressBar} ${percent}%\n`;
    message += `💵 Total Reserved: $${updated.currentlyReserved.toFixed(2)} / $${updated.amount.toFixed(2)}\n`;
    message += stillNeeded <= 0
      ? `\n🎉 Fully funded! You have enough set aside.`
      : `⚠️ Still Need: $${stillNeeded.toFixed(2)}`;

    await this.bot.sendMessage(chatId, message);
  }

  async handleUpcomingExpenseIntent(chatId, intent) {
    switch (intent.action) {
      case 'list':
        await this.handleListUpcomingExpenses(chatId);
        break;

      case 'reserve':
        await this.handleReserveFunds(chatId, intent);
        break;

      case 'check':
        const expense = this.bills.getUpcomingExpenseByName(intent.expenseName);
        if (expense) {
          const daysUntil = Math.ceil(
            (new Date(expense.dueDate) - new Date()) / (1000 * 60 * 60 * 24)
          );
          const stillNeeded = expense.amount - expense.currentlyReserved;
          const percent = Math.min(100, (expense.currentlyReserved / expense.amount * 100)).toFixed(0);
          const progressBar = this.generateProgressBar(parseFloat(percent));

          await this.bot.sendMessage(chatId,
            `📋 ${expense.name}\n\n` +
            `${progressBar} ${percent}%\n` +
            `💰 Total: $${expense.amount.toFixed(2)}\n` +
            `💵 Reserved: $${expense.currentlyReserved.toFixed(2)}\n` +
            `⚠️ Still Needed: $${stillNeeded.toFixed(2)}\n` +
            `📅 Due in ${daysUntil} days`
          );
        } else {
          await this.handleListUpcomingExpenses(chatId);
        }
        break;

      default:
        await this.handleListUpcomingExpenses(chatId);
    }
  }

  generateProgressBar(percentage) {
    const capped = Math.min(100, Math.max(0, percentage));
    const filled = Math.round(capped / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
  }
  
  async handleCheckDueBills(chatId, timeframe) {
    let bills;
    let title;
  
    if (timeframe === 'today') {
      bills = this.bills.getBillsDueToday();
      title = '📅 Bills Due TODAY:';
    } else if (timeframe === 'week') {
      const today = new Date();
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      bills = this.bills.getBillsInDateRange(today.toISOString().split('T')[0], weekFromNow.toISOString().split('T')[0]);
      title = '📅 Bills Due This Week:';
    } else {
      // Default to 4 days
      bills = [
        ...this.bills.getBillsDueToday(),
        ...this.bills.getBillsDueInDays(4)
      ];
      title = '📅 Bills Due Soon:';
    }
  
    if (bills.length === 0) {
      await this.bot.sendMessage(chatId, `✅ No bills due ${timeframe || 'soon'}!`);
      return;
    }
  
    const totals = this.bills.calculateTotalDue(bills);
  
    let message = `${title}\n\n`;
  
    // Group by need action
    const needAction = bills.filter(b => b.needsAction);
    const autopay = bills.filter(b => b.autopay && !b.paid);
    const paid = bills.filter(b => b.paid);
  
    if (needAction.length > 0) {
      message += '⚠️ NEEDS YOUR ACTION:\n';
      needAction.forEach(bill => {
        const amountStr = bill.isVariable ? 'Variable amount' : `$${bill.amount.toFixed(2)}`;
        message += `  • ${bill.name} - ${amountStr}\n`;
      });
      message += '\n';
    }
  
    if (autopay.length > 0) {
      message += '✅ On Autopay:\n';
      autopay.forEach(bill => {
        const amountStr = bill.isVariable ? 'Variable' : `$${bill.amount.toFixed(2)}`;
        message += `  • ${bill.name} - ${amountStr}\n`;
      });
      message += '\n';
    }
  
    if (paid.length > 0) {
      message += '✔️ Already Paid:\n';
      paid.forEach(bill => {
        message += `  • ${bill.name}\n`;
      });
      message += '\n';
    }
  
    message += `💵 Total Due: $${totals.total.toFixed(2)}\n`;
    if (totals.estimatedVariable > 0) {
      message += `   (includes ~$${totals.estimatedVariable.toFixed(2)} estimated variable)\n`;
    }
    message += `⚠️ Manual Payments: $${totals.manual.toFixed(2)}\n`;
    message += `✅ Autopay: $${totals.autopay.toFixed(2)}`;
  
    await this.bot.sendMessage(chatId, message);
  }
  
  async handleRecordBillPayment(chatId, intent) {
    if (!intent.billName) {
      await this.bot.sendMessage(chatId, 
        '❓ Which bill did you pay? Please specify the name.'
      );
      return;
    }
  
    const bill = this.bills.getBillByName(intent.billName);
    
    if (!bill) {
      await this.bot.sendMessage(chatId,
        `❌ I couldn't find a bill named "${intent.billName}".\n\n` +
        `Use /bills to see all your bills.`
      );
      return;
    }
  
    const amount = intent.amount || bill.amount;
  
    if (!amount) {
      await this.bot.sendMessage(chatId,
        `💰 How much did you pay for ${bill.name}?\n\n` +
        `Reply with: "I paid ${bill.name} $[amount]"`
      );
      return;
    }
  
    const payment = this.bills.recordPayment(bill.id, amount, null, bill.type === 'recurring');
  
    let message = `✅ Payment recorded!\n\n`;
    message += `📋 ${bill.name}\n`;
    message += `💰 Amount: $${amount.toFixed(2)}\n`;
    message += `📅 Date: ${new Date(payment.paymentDate).toLocaleDateString('en-US')}`;
  
    await this.bot.sendMessage(chatId, message);
  }
  
  async handleCashflowCheck(chatId, timeframe) {
    let bills;
    let title;
  
    if (timeframe === 'today') {
      bills = this.bills.getBillsDueToday();
      title = 'today';
    } else if (timeframe === 'week') {
      const today = new Date();
      const weekFromNow = new Date(today);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      bills = this.bills.getBillsInDateRange(today.toISOString().split('T')[0], weekFromNow.toISOString().split('T')[0]);
      title = 'this week';
    } else {
      bills = [
        ...this.bills.getBillsDueToday(),
        ...this.bills.getBillsDueInDays(4)
      ];
      title = 'in the next 4 days';
    }
  
    const totals = this.bills.calculateTotalDue(bills);
  
    let message = `💰 Cash Flow Analysis for ${title}:\n\n`;
    message += `📊 Total Bills: ${bills.length}\n`;
    message += `💵 Total Amount: $${totals.total.toFixed(2)}\n`;
    
    if (totals.estimatedVariable > 0) {
      message += `   • Fixed: $${totals.fixed.toFixed(2)}\n`;
      message += `   • Variable (estimated): $${totals.estimatedVariable.toFixed(2)}\n`;
    }
    
    message += `\n⚠️ Manual Payments: $${totals.manual.toFixed(2)}\n`;
    message += `✅ Autopay: $${totals.autopay.toFixed(2)}\n`;
    message += `\n🔔 Bills Needing Action: ${totals.billsNeedingAction}\n`;
    
    if (totals.billsNeedingAction > 0) {
      message += `\n💡 Make sure you have $${totals.manual.toFixed(2)} available in your payment account!`;
    }
  
    await this.bot.sendMessage(chatId, message);
  }

  async handlePaymentRecord(chatId, intent) {
    if (!intent.tenantName) {
      await this.bot.sendMessage(chatId, 
        '❓ Which tenant made the payment? Please specify the name.'
      );
      return;
    }
  
    // Find tenant by name
    const tenant = this.tenant.getTenantByName(intent.tenantName);
    
    if (!tenant) {
      await this.bot.sendMessage(chatId,
        `❌ I couldn't find a tenant named "${intent.tenantName}".\n\n` +
        `Available tenants:\n` +
        this.tenant.getAllTenants().map(t => `• ${t.name}`).join('\n')
      );
      return;
    }
  
    // Determine amount
    const amount = intent.amount || tenant.rentAmount;
    const paymentType = intent.paymentType === 'partial' ? 'partial' : 'full';
  
    // Record the payment
    const payment = this.tenant.recordPayment(tenant.id, amount, paymentType);
  
    // Check payment status
    const status = this.tenant.hasPaymentForMonth(tenant.id);
  
    let message = `✅ Payment recorded!\n\n`;
    message += `👤 ${tenant.name}\n`;
    message += `💰 Amount: $${amount.toFixed(2)}\n`;
    
    if (status.paid) {
      message += `✅ Status: PAID IN FULL\n`;
    } else if (status.partial) {
      message += `⚠️  Status: PARTIAL PAYMENT\n`;
      message += `💵 Paid: $${status.totalPaid.toFixed(2)} / $${tenant.rentAmount.toFixed(2)}\n`;
      message += `📉 Remaining: $${status.remaining.toFixed(2)}\n`;
    }
  
    await this.bot.sendMessage(chatId, message);
  }

  async handleTenantIntent(chatId, intent) {
    switch (intent.action) {
      case 'add':
        if (!intent.tenantName || !intent.rentAmount) {
          await this.bot.sendMessage(chatId,
            '❌ I need at least a name and rent amount.\n\n' +
            'Example: "Add tenant John Smith, rent $1200, phone 555-1234"'
          );
          return;
        }
        
        const tenant = this.tenant.addTenant({
          name: intent.tenantName,
          phone: intent.phone,
          rentAmount: intent.rentAmount,
          rentDueDay: 1,
          paymentMethod: intent.paymentMethod || 'bank transfer',
          property: intent.unit || ''
        });
        
        await this.bot.sendMessage(chatId,
          `✅ Tenant added!\n\n` +
          `👤 ${tenant.name}\n` +
          `💰 Rent: $${tenant.rentAmount}\n` +
          `📱 Phone: ${tenant.phone || 'Not provided'}`
        );
        break;
      
      case 'list':
        await this.handleTenantsCommand(chatId);
        break;
      
      case 'reminder':
        await this.handleRentReminderCommand(chatId, ['rentReminder']);
        break;
      
      case 'payment':
        if (intent.tenantName) {
          await this.bot.sendMessage(chatId, 
            `✅ Noted payment from ${intent.tenantName}! Would you like me to record the amount?`
          );
        } else {
          await this.bot.sendMessage(chatId, 
            '✅ Payment received! Which tenant made the payment?'
          );
        }
        break;
      
      case 'update':
        await this.bot.sendMessage(chatId,
          '📝 What would you like to update? You can modify:\n' +
          '• Rent amount\n' +
          '• Phone number\n' +
          '• Payment method\n' +
          '• Due date'
        );
        break;
    }
  }

  async handleWeatherQuery(chatId, userMessage) {
    try {
      // Fetch real weather data
      const weatherData = await this.weather.getCurrentWeather();
      const weatherContext = this.weather.formatWeatherForLLM(weatherData);
  
      // Build conversation with weather context ONLY
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful personal assistant. Answer the weather question naturally and conversationally using the provided data. Do not mention that data was "provided" - just answer as if you know it.'
        },
        {
          role: 'user',
          content: `Current weather data: ${weatherContext}\n\nQuestion: ${userMessage}`
        }
      ];
  
      // Get LLM response with real weather data
      const response = await this.ollama.chat(messages);
      
      // Save both to memory
      this.memory.addMessage('user', userMessage);
      this.memory.addMessage('assistant', response.content);
  
      await this.bot.sendMessage(chatId, response.content);
    } catch (error) {
      console.error('Weather query error:', error);
      
      // Fallback: send weather data directly
      const weatherData = await this.weather.getCurrentWeather();
      const weatherText = this.weather.formatWeatherForUser(weatherData);
      await this.bot.sendMessage(chatId, weatherText);
    }
  }
  
  async handleCheckRequest(chatId, checkIntent) {
    try {
      const { convertToCheckWords } = await import('../utils/checkWriter.js');
      
      console.log('💵 Processing check for amount:', checkIntent.amount);
      
      const checkData = convertToCheckWords(checkIntent.amount);
      
      // Get today's date in format: Feb 17, 2026
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
      
      const message = 
        `✅ Check Amount: ${checkData.numeric}\n` +
        `📅 Date: ${dateStr}\n\n` +
        `Written Amount:\n${checkData.words}\n\n`;
      
      this.memory.addMessage('assistant', message);
      await this.bot.sendMessage(chatId, message);
    } catch (error) {
      console.error('Check writing error:', error);
      await this.bot.sendMessage(chatId, 
        '❌ Invalid amount format. Please use: write check $1234.56'
      );
    }
  }

  async handleAddTenant(chatId, text) {
    // Extract tenant info from message
    const nameMatch = text.match(/tenant\s+([^,]+)/i);
    const rentMatch = text.match(/rent\s+\$?(\d+)/i);
    const phoneMatch = text.match(/phone\s+([\d-]+)/i);
    const unitMatch = text.match(/unit\s+([^\s,]+)/i);
    
    if (!nameMatch || !rentMatch) {
      await this.bot.sendMessage(chatId,
        '❌ I need at least a name and rent amount.\n\n' +
        'Example: "Add tenant John Smith, rent $1200, phone 555-1234, unit 2B"'
      );
      return;
    }
    
    const name = nameMatch[1].trim();
    const rent = parseInt(rentMatch[1]);
    const phone = phoneMatch ? phoneMatch[1] : null;
    const unit = unitMatch ? unitMatch[1] : null;
    
    const tenant = this.tenant.addTenant(name, phone, null, rent, unit);
    
    await this.bot.sendMessage(chatId,
      `✅ Tenant added!\n\n` +
      `👤 ${tenant.name}${unit ? ` (Unit ${unit})` : ''}\n` +
      `💰 Rent: $${tenant.rent}\n` +
      `📅 Due: ${tenant.dueDay}${this.getOrdinalSuffix(tenant.dueDay)} of each month\n` +
      `📱 Phone: ${phone || 'Not provided'}`
    );
  }

  async handleCalendarIntent(chatId, originalMessage, intent) {
    console.log('📅 Calendar intent detected:', intent);

    try {
      switch (intent.action) {
        case 'view':
          await this.handleViewCalendar(chatId, intent);
          break;
        
        case 'add':
          await this.handleAddEvent(chatId, intent);
          break;
        
        case 'edit':
          await this.bot.sendMessage(chatId, 
            '📝 To edit an event, please:\n' +
            '1. Use /calendar to see today\'s events\n' +
            '2. Tell me which event to change and what to update'
          );
          break;
        
        case 'delete':
          await this.bot.sendMessage(chatId,
            '🗑️ To delete an event, please:\n' +
            '1. Use /calendar to see events\n' +
            '2. Tell me which event to delete'
          );
          break;
      }
    } catch (error) {
      console.error('Calendar intent error:', error);
      await this.bot.sendMessage(chatId, '❌ Sorry, I had trouble with that calendar request.');
    }
  }

  async handleViewCalendar(chatId, intent) {
    let events;
    let dateStr;

    if (intent.when) {
      // Specific date requested
      const date = new Date(intent.when);
      dateStr = date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      
      events = await this.calendar.getEventsByDate(intent.when);
    } else {
      // Default to today
      dateStr = 'Today';
      events = await this.calendar.getTodayEvents();
    }

    if (events.length === 0) {
      await this.bot.sendMessage(chatId, `📅 No events scheduled for ${dateStr}.`);
    } else {
      const eventList = events.map(e => 
        `• ${e.time}: ${e.summary}`
      ).join('\n');
      await this.bot.sendMessage(chatId, `📅 Events for ${dateStr}:\n\n${eventList}`);
    }
  }

  async handleAddEvent(chatId, intent) {
    if (!intent.summary || !intent.when || !intent.time) {
      await this.bot.sendMessage(chatId,
        '📅 I need more details to add this event. Please include:\n' +
        '• What: Event title\n' +
        '• When: Date (today, tomorrow, or specific date)\n' +
        '• Time: What time (e.g., 2pm, 14:00)\n\n' +
        'Example: "Schedule meeting with John tomorrow at 3pm"'
      );
      return;
    }

    try {
      // Parse the time and create start/end times
      const [hours, minutes] = intent.time.split(':').map(Number);
      const startDate = new Date(intent.when);
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (intent.duration || 60));

      // Create the event
      const event = await this.calendar.createEvent(
        intent.summary,
        startDate.toISOString(),
        endDate.toISOString(),
        intent.details || ''
      );

      const dateStr = startDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
      });
      const timeStr = startDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });

      await this.bot.sendMessage(chatId,
        `✅ Event added!\n\n` +
        `📅 ${intent.summary}\n` +
        `🗓️ ${dateStr}\n` +
        `⏰ ${timeStr}\n` +
        `⏱️ Duration: ${intent.duration || 60} minutes`
      );
    } catch (error) {
      console.error('Error adding event:', error);
      await this.bot.sendMessage(chatId, 
        '❌ Failed to add event to calendar. Make sure Google Calendar is set up correctly.'
      );
    }
  }

  async handleTenantsCommand(chatId) {
    const tenants = this.tenant.getAllTenants();
    
    if (tenants.length === 0) {
      await this.bot.sendMessage(chatId,
        '🏠 No tenants added yet.\n\n' +
        'To add a tenant, just tell me:\n' +
        '"Add tenant John Doe, phone 555-1234, rent $1500, due on the 1st, payment via Zelle"'
      );
      return;
    }

    const tenantList = tenants.map((t, i) =>
      `${i + 1}. ${t.name}\n` +
      `   📱 ${t.phone}\n` +
      `   💰 $${t.rentAmount}/month (due: ${t.rentDueDay}th)\n` +
      `   💳 Payment: ${t.paymentMethod}`
    ).join('\n\n');

    await this.bot.sendMessage(chatId, `🏠 Your Tenants:\n\n${tenantList}`);
  }

  async handleRentReminderCommand(chatId, args) {
    // Change this line:
    const templateType = args[0] || 'rentReminder';  // Use 'rentReminder' not 'standard'
    
    const reminders = this.tenant.generateAllRentReminders(templateType);
  
    if (reminders.length === 0) {
      await this.bot.sendMessage(chatId, '🏠 No tenants to send reminders to.');
      return;
    }
  
    await this.bot.sendMessage(chatId, 
      `📨 Generating ${reminders.length} rent reminder(s)...\n\n` +
      'Review and confirm to send:'
    );
  
    for (const reminder of reminders) {
      await this.bot.sendMessage(chatId,
        `To: ${reminder.tenant.name} (${reminder.tenant.phone})\n\n` +
        `${reminder.message}\n\n` +
        `[This message is ready to copy and send]`
      );
      
      // Mark as sent
      this.tenant.markReminderSent(reminder.tenant.id);
    }
  
    await this.bot.sendMessage(chatId, 
      `✅ All reminders generated!\n\n` +
      `Copy the messages above and send them to your tenants via their preferred method.`
    );
  }

  async handleCommand(chatId, text) {
    const [command, ...args] = text.split(' ');
  
    // Show typing immediately for all commands
    await this.sendTyping(chatId);
  
    switch (command) {
      case '/briefing':
        try {
          // Send status message first
          await this.bot.sendMessage(chatId, '📊 Generating your briefing...');
          
          // Then show typing while working
          await this.sendTypingWhile(chatId, async () => {
            const briefingMessage = await this.briefing.generateMorningBriefing();
            await this.bot.sendMessage(chatId, briefingMessage);
          });
        } catch (error) {
          console.error('Briefing error:', error);
          await this.bot.sendMessage(chatId, '❌ Error generating briefing. Check logs.');
        }
        break;
  
      case '/bills':
        await this.sendTypingWhile(chatId, async () => {
          await this.handleListBills(chatId);
        });
        break;
  
      case '/upcoming':
        await this.sendTypingWhile(chatId, async () => {
          await this.handleListUpcomingExpenses(chatId);
        });
        break;
  
      case '/calendar':
        await this.sendTypingWhile(chatId, async () => {
          try {
            const events = await this.calendar.getTodayEvents();
            if (events.length === 0) {
              await this.bot.sendMessage(chatId, '📅 No events scheduled for today.');
            } else {
              const eventList = events.map(e => `• ${e.time}: ${e.summary}`).join('\n');
              await this.bot.sendMessage(chatId, `📅 Today's events:\n\n${eventList}`);
            }
          } catch (error) {
            await this.bot.sendMessage(chatId, '❌ Error fetching calendar events.');
          }
        });
        break;
  
      case '/tenants':
        await this.sendTypingWhile(chatId, async () => {
          await this.handleTenantsCommand(chatId);
        });
        break;
  
      case '/rentreminder':
        await this.sendTypingWhile(chatId, async () => {
          await this.handleRentReminderCommand(chatId, args);
        });
        break;

      case '/check':
        const amount = args.join(' ');
        if (!amount) {
          await this.bot.sendMessage(chatId, 
            'Usage: /check $1234.56\n' +
            'Or: /check 1234.56\n\n' +
            'Examples:\n' +
            '/check $2630.40\n' +
            '/check 1500\n' +
            '/check $12,345.67'
          );
          break;
        }
        
        console.log('💵 /check command with amount:', amount);
        
        const checkIntent = await this.ollama.extractCheckIntent(`write check ${amount}`);
        if (checkIntent.action === 'write_check') {
          await this.handleCheckRequest(chatId, checkIntent);
        } else {
          await this.bot.sendMessage(chatId, 
            '❌ Could not parse amount. Use format: $1234.56'
          );
        }
        break;

      // Fast commands - just sendTyping once is fine
      case '/start':
        await this.bot.sendMessage(chatId,
          '👋 Welcome to your Pi Local Assistant!\n\n' +
          'Commands:\n' +
          '/help - Show commands\n' +
          '/tasks - Show your tasks\n' +
          '/calendar - Today\'s calendar\n' +
          '/briefing - Morning briefing\n' +
          '/bills - View bills\n' +
          '/upcoming - Upcoming expenses\n\n' +
          'Just chat with me naturally!'
        );
        break;
  
      case '/help':
        await this.bot.sendMessage(chatId,
          '🤖 Available commands:\n\n' +
          '📅 Calendar & Tasks:\n' +
          '/calendar - Today\'s events\n' +
          '/tasks - Your tasks\n' +
          '/briefing - Morning briefing\n\n' +
          '🏠 Property Management:\n' +
          '/tenants - View tenants\n' +
          '/rentreminder - Rent reminders\n' +
          '/payments - Payment status\n\n' +
          '💰 Bill Tracking:\n' +
          '/bills - List all bills\n' +
          '/billsdue - Due today\n' +
          '/cashflow - Cash flow\n' +
          '/upcoming - Upcoming expenses\n\n' +
          '💵 Check Writer:\n' +
          '/check $2,630.30 - Write a check\n' +
          'Or: "convert $2,630.30 to words"\n\n' +
          '🛠️ Other:\n' +
          '/weather - Weather\n' +
          '/context - Time context\n' +
          '/clear - Clear memory'
        );
        break;
  
      case '/clear':
        this.memory.clearMessages();
        await this.bot.sendMessage(chatId, '🗑️ Conversation memory cleared!');
        break;
  
      default:
        await this.bot.sendMessage(chatId,
          `❓ Unknown command: ${command}\nType /help for available commands.`
        );
    }
  }

  async handleRentReminderCommand(chatId, args) {
    const templateName = args[0] || 'standard';
    const reminders = this.tenant.generateAllRentReminders(templateName);
    
    if (reminders.length === 0) {
      await this.bot.sendMessage(chatId, '👥 No active tenants to send reminders to.');
      return;
    }

    let response = `📧 Rent Reminders (${templateName} template):\n\n`;
    
    for (const reminder of reminders) {
      response += `👤 ${reminder.tenantName}${reminder.tenant.unit ? ` (Unit ${reminder.tenant.unit})` : ''}\n`;
      response += `📱 ${reminder.phone || 'No phone'}\n`;
      response += `💬 Message:\n"${reminder.message}"\n\n`;
      response += '─────────────────\n\n';
    }

    response += 'Templates: standard, friendly, received, grace_period, late_notice\n';
    response += 'Usage: /rentreminder [template]\n';
    response += 'Example: /rentreminder friendly';

    // Split message if too long
    if (response.length > 4000) {
      const messages = this.splitMessage(response, 4000);
      for (const msg of messages) {
        await this.bot.sendMessage(chatId, msg);
      }
    } else {
      await this.bot.sendMessage(chatId, response);
    }
  }

  getOrdinalSuffix(day) {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  splitMessage(text, maxLength) {
    const messages = [];
    let currentMessage = '';
    
    const lines = text.split('\n');
    for (const line of lines) {
      if ((currentMessage + line + '\n').length > maxLength) {
        messages.push(currentMessage);
        currentMessage = line + '\n';
      } else {
        currentMessage += line + '\n';
      }
    }
    
    if (currentMessage) {
      messages.push(currentMessage);
    }
    
    return messages;
  }

  async sendMessage(text) {
    if (!this.chatId) {
      console.error('No chatId configured for sending messages');
      return;
    }
    await this.bot.sendMessage(this.chatId, text);
  }

  async sendTyping(chatId) {
    try {
      await this.bot.sendChatAction(chatId, 'typing');
      console.log(`⌨️  Typing indicator sent to ${chatId}`);
    } catch (error) {
      console.error('Typing indicator error:', error.message);
    }
  }

  async sendTypingWhile(chatId, asyncFunction) {
    let isWorking = true;
    let intervalId = null;
  
    // Send typing immediately
    await this.sendTyping(chatId);
  
    // Refresh every 3 seconds (Telegram clears it after 5 seconds)
    intervalId = setInterval(async () => {
      if (isWorking) {
        try {
          await this.bot.sendChatAction(chatId, 'typing');
        } catch (err) {
          // Ignore errors in interval
        }
      }
    }, 3000);
  
    try {
      const result = await asyncFunction();
      return result;
    } catch (error) {
      throw error;
    } finally {
      // Always clean up
      isWorking = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  }

  stop() {
    this.bot.stopPolling();
    console.log('📱 Telegram bot stopped');
  }
}
