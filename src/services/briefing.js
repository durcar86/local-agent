import axios from 'axios';

export class BriefingService {
  constructor(config, ollamaService, calendarService, tenantService, billsService) {
    this.config = config;
    this.ollama = ollamaService;
    this.calendar = calendarService;
    this.tenantService = tenantService;
    this.billsService = billsService;
  }

  async generateMorningBriefing() {
    const sections = [];
  
    // Header
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    sections.push(`🌅 Good morning! Today is ${date}\n`);
  
    // Get financial data
    try {
      const financialData = await this.getFinancialData();
      sections.push(financialData);
    } catch (error) {
      console.error('Error fetching financial data:', error.message);
      sections.push('📊 Financial data temporarily unavailable\n');
    }
  
    // Get weather
    try {
      const weather = await this.getWeather();
      sections.push(weather);
    } catch (error) {
      console.error('Error fetching weather:', error.message);
      sections.push('🌤️ Weather data temporarily unavailable\n');
    }
  
    // Get tenant rent reminders (ADD THIS)
    try {
      const rentReminders = await this.getTenantRentReminders();
      if (rentReminders) {
        sections.push(rentReminders);
      }
    } catch (error) {
      console.error('Error fetching rent reminders:', error.message);
    }

    // Get bill reminders (ADD THIS)
    try {
      const billReminders = await this.getBillReminders();
      if (billReminders) {
        sections.push(billReminders);
      }
    } catch (error) {
      console.error('Error fetching bill reminders:', error.message);
    }

    try {
      const expensesReminder = await this.getUpcomingExpensesReminder();
      if (expensesReminder) {
        sections.push(expensesReminder);
      }
    } catch (error) {
      console.error('Error fetching savings goals:', error.message);
    }

    // Get calendar events
    try {
      const events = await this.calendar.getTodayEvents();
      if (events.length > 0) {
        const eventList = events.map(e => `  • ${e.time}: ${e.summary}`).join('\n');
        sections.push(`📅 Your schedule today:\n${eventList}\n`);
      } else {
        sections.push('📅 No events scheduled for today\n');
      }
    } catch (error) {
      console.error('Error fetching calendar:', error.message);
    }
    /*  
    // Get business news headlines
    try {
      const news = await this.getBusinessNews();
      sections.push(news);
    } catch (error) {
      console.error('Error fetching news:', error.message);
      sections.push('📰 News temporarily unavailable\n');
    }
      */
    return sections.join('\n');
  }

  async getFinancialData() {
    const lines = ['💰 Market Update:\n'];

    // Bitcoin price
    try {
      const btcResponse = await axios.get('https://api.coinbase.com/v2/prices/BTC-USD/spot', {
        timeout: 5000
      });
      const btcPrice = parseFloat(btcResponse.data.data.amount);
      lines.push(`  🪙 Bitcoin: $${btcPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } catch (error) {
      lines.push('  🪙 Bitcoin: N/A');
    }

    // QQQ - Using Yahoo Finance alternative data source
    try {
      const qqqResponse = await axios.get('https://query1.finance.yahoo.com/v8/finance/chart/QQQ', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'Referer': 'https://query1.finance.yahoo.com/'
        }
      });
      const qqqPrice = qqqResponse.data.chart.result[0].meta.regularMarketPrice;
      const qqqChange = qqqResponse.data.chart.result[0].meta.regularMarketChangePercent;
      const changeSymbol = qqqChange >= 0 ? '📈' : '📉';
      lines.push(`  ${changeSymbol} QQQ: $${qqqPrice.toFixed(2)} (${qqqChange >= 0 ? '+' : ''}${qqqChange.toFixed(2)}%)`);
    } catch (error) {
      lines.push('  📊 QQQ: N/A');
    }

    return lines.join('\n') + '\n';
  }

  async getBillReminders() {
    if (!this.billsService) {
      return '';
    }
  
    const billsDueToday = this.billsService.getBillsDueToday();
    const billsDueIn4Days = this.billsService.getBillsDueInDays(4);
  
    if (billsDueToday.length === 0 && billsDueIn4Days.length === 0) {
      return '';
    }
  
    const lines = [];
  
    // Bills due TODAY
    if (billsDueToday.length > 0) {
      const needAction = billsDueToday.filter(b => b.needsAction);
      const autopay = billsDueToday.filter(b => b.autopay && !b.paid);
      const totalsToday = this.billsService.calculateTotalDue(billsDueToday);
  
      lines.push('💵 BILLS DUE TODAY:\n');
  
      if (needAction.length > 0) {
        lines.push('⚠️ NEEDS YOUR ACTION:');
        needAction.forEach(bill => {
          const amountStr = bill.isVariable ? 'Variable' : `$${bill.amount.toFixed(2)}`;
          lines.push(`  • ${bill.name} - ${amountStr}`);
        });
        lines.push('');
      }
  
      if (autopay.length > 0) {
        lines.push('✅ On Autopay:');
        autopay.forEach(bill => {
          const amountStr = bill.isVariable ? 'Variable' : `$${bill.amount.toFixed(2)}`;
          lines.push(`  • ${bill.name} - ${amountStr}`);
        });
        lines.push('');
      }
  
      lines.push(`💰 Total Due Today: $${totalsToday.total.toFixed(2)}`);
      if (totalsToday.manual > 0) {
        lines.push(`⚠️ Manual Payment Needed: $${totalsToday.manual.toFixed(2)}`);
      }
      lines.push('');
    }
  
    // Bills due in 4 days
    if (billsDueIn4Days.length > 0) {
      const totals4Days = this.billsService.calculateTotalDue(billsDueIn4Days);
      
      lines.push('📅 Bills Due in 4 Days:\n');
      billsDueIn4Days.forEach(bill => {
        const amountStr = bill.isVariable ? 'Variable' : `$${bill.amount.toFixed(2)}`;
        const actionStr = bill.needsAction ? '⚠️' : '✅';
        lines.push(`  ${actionStr} ${bill.name} - ${amountStr}`);
      });
      lines.push('');
      lines.push(`💰 Total: $${totals4Days.total.toFixed(2)}`);
      lines.push('');
    }
  
    if (lines.length > 0) {
      lines.push('Use /bills for details\n');
      return lines.join('\n');
    }
  
    return '';
  }

  async getWeather() {
    try {
      // Using wttr.in - a simple weather API that doesn't require API keys
      const response = await axios.get(`https://wttr.in/${this.config.location.city}?format=j1`, {
        timeout: 500000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
          'Referer': 'https://wttr.in/'
        }
      });

      const current = response.data.current_condition[0];
      const temp = current.temp_F;
      const desc = current.weatherDesc[0].value;
      const humidity = current.humidity;
      const feelsLike = current.FeelsLikeF;

      return `🌤️ Weather in ${this.config.location.state}:\n  Temperature: ${temp}°F (feels like ${feelsLike}°F)\n  Conditions: ${desc}\n  Humidity: ${humidity}%\n`;
    } catch (error) {
      return '🌤️ Weather data temporarily unavailable\n';
    }
  }

  async getRentReminders(tenantService) {
    const today = new Date();
    const targetDay = 25; // Send reminders on the 25th
    
    if (today.getDate() !== targetDay) {
      return '';
    }
  
    const tenants = tenantService.getAllTenants();
    if (tenants.length === 0) return '';
  
    const lines = ['🏠 RENT REMINDER - Time to message your tenants!\n'];
    lines.push(`You have ${tenants.length} tenant(s) to remind.`);
    lines.push('Use /rentreminder to generate messages.\n');
  
    return lines.join('\n');
  }

  async getTenantRentReminders() {
    if (!this.tenantService) {
      return '';
    }
  
    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.toISOString().slice(0, 7);
    
    const tenants = this.tenantService.getAllTenants();
    if (tenants.length === 0) {
      return '';
    }
  
    const dueToday = [];
    const pastDue = [];
    const upcomingSoon = [];
  
    for (const tenant of tenants) {
      // Check if already paid this month
      const paymentStatus = this.tenantService.hasPaymentForMonth(tenant.id, currentMonth);
      
      // Skip if already paid in full
      if (paymentStatus && paymentStatus.paid) {
        continue;
      }
  
      const dueDay = tenant.rentDueDay;
      
      // Check if rent is due today
      if (dueDay === currentDay) {
        dueToday.push({ tenant, paymentStatus });
      }
      // Check if rent is past due
      else if (dueDay < currentDay) {
        const daysPastDue = currentDay - dueDay;
        pastDue.push({ tenant, daysPastDue, paymentStatus });
      }
      // Check if rent is due within 3 days
      else if (dueDay > currentDay && dueDay <= currentDay + 3) {
        const daysUntil = dueDay - currentDay;
        upcomingSoon.push({ tenant, daysUntil, paymentStatus });
      }
    }
  
    const lines = [];
  
    // Past due (most urgent)
    if (pastDue.length > 0) {
      lines.push('🚨 RENT PAST DUE:\n');
      pastDue.forEach(({ tenant, daysPastDue, paymentStatus }) => {
        lines.push(`  ⚠️  ${tenant.name} - ${daysPastDue} day${daysPastDue > 1 ? 's' : ''} late`);
        
        if (paymentStatus && paymentStatus.partial) {
          lines.push(`     💵 Paid: $${paymentStatus.totalPaid.toFixed(2)} / $${tenant.rentAmount.toFixed(2)}`);
          lines.push(`     📉 Remaining: $${paymentStatus.remaining.toFixed(2)}`);
        } else {
          lines.push(`     💰 $${tenant.rentAmount.toFixed(2)} (due: ${tenant.rentDueDay}th)`);
        }
        
        lines.push(`     📱 ${tenant.phone}`);
      });
      lines.push('');
    }
  
    // Due today
    if (dueToday.length > 0) {
      lines.push('💵 TENANT RENT DUE TODAY:\n');
      dueToday.forEach(({ tenant, paymentStatus }) => {
        lines.push(`  📌 ${tenant.name}`);
        
        if (paymentStatus && paymentStatus.partial) {
          lines.push(`     💵 Partial paid: $${paymentStatus.totalPaid.toFixed(2)}`);
          lines.push(`     📉 Still owed: $${paymentStatus.remaining.toFixed(2)}`);
        } else {
          lines.push(`     💰 $${tenant.rentAmount.toFixed(2)}`);
        }
        
        lines.push(`     📱 ${tenant.phone}`);
        lines.push(`     💳 ${tenant.paymentMethod}`);
      });
      lines.push('');
    }
  
    // Upcoming soon
    if (upcomingSoon.length > 0) {
      lines.push('📅 Rent Due Soon:\n');
      upcomingSoon.sort((a, b) => a.daysUntil - b.daysUntil);
      upcomingSoon.forEach(({ tenant, daysUntil }) => {
        lines.push(`  • ${tenant.name} - ${daysUntil} day${daysUntil > 1 ? 's' : ''} (${tenant.rentDueDay}th)`);
        lines.push(`     💰 $${tenant.rentAmount.toFixed(2)}`);
      });
      lines.push('');
    }
  
    if (lines.length > 0) {
      lines.push('Use /rentreminder to generate messages\n');
      return lines.join('\n');
    }
  
    return '';
  }

  async getUpcomingExpensesReminder() {
    if (!this.billsService) {
      return '';
    }
  
    const summary = this.billsService.getUpcomingExpensesSummary();
    
    if (!summary) {
      return '';
    }
  
    const lines = [];
  
    // Urgent expenses (due within 30 days)
    if (summary.urgent.length > 0) {
      lines.push('⚠️ UPCOMING EXPENSES - Due Within 30 Days:\n');
      
      summary.urgent.forEach(expense => {
        const statusIcon = expense.percentReserved >= 100 ? '✅' : 
                          expense.percentReserved >= 50 ? '🟡' : '🔴';
        lines.push(`  ${statusIcon} ${expense.name}`);
        lines.push(`     💰 Amount: $${expense.amount.toFixed(2)}`);
        lines.push(`     📅 Due in ${expense.daysUntilDue} days (${new Date(expense.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`);
        
        if (expense.currentlyReserved > 0) {
          lines.push(`     💵 Reserved: $${expense.currentlyReserved.toFixed(2)} (${expense.percentReserved.toFixed(0)}%)`);
          if (expense.stillNeeded > 0) {
            lines.push(`     ⚠️ Still Need: $${expense.stillNeeded.toFixed(2)}`);
          }
        } else {
          lines.push(`     ⚠️ Not yet reserved`);
        }
        lines.push('');
      });
    }
  
    // Other upcoming (31-90 days)
    if (summary.upcoming.length > 0) {
      lines.push('📅 Coming Soon (31-90 Days):\n');
      
      summary.upcoming.forEach(expense => {
        lines.push(`  • ${expense.name} - $${expense.amount.toFixed(2)}`);
        lines.push(`    Due ${new Date(expense.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${expense.daysUntilDue} days)`);
      });
      lines.push('');
    }
  
    // Summary
    if (summary.totalStillNeeded > 0) {
      lines.push(`💡 Total Still Needed: $${summary.totalStillNeeded.toFixed(2)}\n`);
    }
  
    return lines.join('\n');
  }

  async getBusinessNews() {
    try {
      // Using a simple RSS feed approach or web scraping for news
      // For production, consider using a proper news API
      const lines = ['📰 Business Headlines:\n'];
      
      // This is a placeholder - you can integrate with news APIs like:
      // - NewsAPI (https://newsapi.org/)
      // - Alpha Vantage News
      // - Google News RSS
      
      lines.push('  • Check your favorite news sources for latest updates');
      
      return lines.join('\n') + '\n';
    } catch (error) {
      return '📰 News temporarily unavailable\n';
    }
  }

  async getTasksAndReminders(memoryService) {
    const tasks = memoryService.getTasks();
    
    if (tasks.length === 0) {
      return '✅ No pending tasks or reminders\n';
    }

    const today = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(t => t.dueDate === today);
    const overdueTasks = tasks.filter(t => t.dueDate && t.dueDate < today);

    const lines = [];

    if (overdueTasks.length > 0) {
      lines.push('⚠️ Overdue tasks:');
      overdueTasks.forEach(t => lines.push(`  • ${t.task}`));
    }

    if (todayTasks.length > 0) {
      lines.push('📋 Tasks due today:');
      todayTasks.forEach(t => lines.push(`  • ${t.task}`));
    }

  // Get rent reminders (around line 40)
  try {
    const rentReminder = await this.getRentReminders(this.tenantService);
    if (rentReminder) {
      sections.push(rentReminder);
    }
  } catch (error) {
    console.error('Error fetching rent reminders:', error.message);
  }
    return lines.join('\n') + '\n';
  }
}
