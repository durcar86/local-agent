import axios from 'axios';

import { convertToCheckWords } from '../utils/checkWriter.js';

export class OllamaService {
  constructor(config) {
    this.baseUrl = config.baseUrl;
    this.model = config.model;
  }

  /**
   * Generate a response from Ollama
   */
  async generate(prompt, systemPrompt = null, context = null) {
    try {
      const payload = {
        model: this.model,
        prompt: prompt,
        stream: false
      };

      if (systemPrompt) {
        payload.system = systemPrompt;
      }

      if (context) {
        payload.context = context;
      }

      const response = await axios.post(`${this.baseUrl}/api/generate`, payload, {
        timeout: 60000 // 60 second timeout
      });

      return {
        response: response.data.response,
        context: response.data.context
      };
    } catch (error) {
      console.error('Ollama generation error:', error.message);
      throw new Error('Failed to generate response from Ollama');
    }
  }

  async extractPaymentIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Quick check for payment keywords
    const paymentKeywords = ['paid', 'payment', 'pay', 'received'];
    const hasPaymentKeyword = paymentKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasPaymentKeyword) {
      return { action: 'none' };
    }
  
    const prompt = `Analyze this message for rent payment information. Return ONLY a JSON object:
  
  {
    "action": "payment|none",
    "tenantName": "name or null",
    "paymentType": "full|partial|none",
    "amount": "amount as number or null"
  }
  
  Examples:
  "John paid rent" -> {"action":"payment","tenantName":"John","paymentType":"full","amount":null}
  "John Smith paid" -> {"action":"payment","tenantName":"John Smith","paymentType":"full","amount":null}
  "Sarah made a partial payment of $500" -> {"action":"payment","tenantName":"Sarah","paymentType":"partial","amount":500}
  "Received payment from Mike" -> {"action":"payment","tenantName":"Mike","paymentType":"full","amount":null}
  "Unit 2B paid $800" -> {"action":"payment","tenantName":"Unit 2B","paymentType":"partial","amount":800}
  
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
      console.error('Failed to parse payment intent:', error.message);
      return { action: 'none' };
    }
  }
  
  async detectRentReminderIntent(message) {
    const keywords = [
      'rent reminder',
      'tenant reminder',
      'send rent',
      'message tenant',
      'rent due',
      'tell me about rent',
      'any rent reminders'
    ];
    
    const lowerMsg = message.toLowerCase();
    return keywords.some(keyword => lowerMsg.includes(keyword));
  }

  async extractTaskIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Quick keyword check
    const taskKeywords = [
      'remind me',
      'remember',
      'don\'t forget',
      'task',
      'todo',
      'to do',
      'note'
    ];
    const hasTaskKeyword = taskKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasTaskKeyword) {
      return [];
    }
  
    const prompt = `Extract tasks or reminders from this message. Return ONLY a JSON array:
  
  [{"task": "description", "dueDate": "YYYY-MM-DD or null"}]
  
  Examples:
  "Remind me to call John tomorrow" -> [{"task":"call John","dueDate":"${this.getTomorrowDate()}"}]
  "Don't forget to buy supplies" -> [{"task":"buy supplies","dueDate":null}]
  "Remember I have a meeting Friday" -> [{"task":"meeting","dueDate":null}]
  "Todo: finish the report by Monday" -> [{"task":"finish the report","dueDate":null}]
  
  IMPORTANT: Only extract actual tasks. Questions should return [].
  
  Today is ${new Date().toISOString().split('T')[0]}.
  User message: "${message}"
  
  JSON array:`;
  
    const response = await this.generate(prompt);
    
    try {
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Failed to parse task intent:', error.message);
      return [];
    }
  }
  
  getTomorrowDate() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  async extractUpcomingExpenseIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    const expenseKeywords = [
      'upcoming',
      'expense',
      'reserve',
      'set aside',
      'lawn',
      'license',
      'tax',
      'insurance',
      'coming up'
    ];
    
    const hasKeyword = expenseKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasKeyword) {
      return { action: 'none' };
    }
  
    const prompt = `Analyze this message for upcoming expense intent. Return ONLY a JSON object:
  
  {
    "action": "list|reserve|add|check|none",
    "expenseName": "name or null",
    "amount": "amount as number or null"
  }
  
  Examples:
  "Show my upcoming expenses" -> {"action":"list","expenseName":null,"amount":null}
  "Reserve $500 for lawn care" -> {"action":"reserve","expenseName":"lawn care","amount":500}
  "I set aside $350 for township license" -> {"action":"reserve","expenseName":"township license","amount":350}
  "What upcoming expenses do I have?" -> {"action":"list","expenseName":null,"amount":null}
  "How much do I need for taxes?" -> {"action":"check","expenseName":"taxes","amount":null}
  
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
      console.error('Failed to parse upcoming expense intent:', error.message);
      return { action: 'none' };
    }
  }

  async detectWeatherIntent(message) {
    const weatherKeywords = ['weather', 'temperature', 'forecast', 'rain', 'sunny', 'cold', 'hot'];
    const lowerMsg = message.toLowerCase();
    return weatherKeywords.some(keyword => lowerMsg.includes(keyword));
  }

  async chatWithContext(messages, contextData = null) {
    try {
  
      // Normal chat flow with context injection
      let systemMessage = messages.find(m => m.role === 'system');
  
      if (contextData && systemMessage) {
        systemMessage.content += `\n\nCurrent information: ${contextData}`;
      } else if (contextData) {
        messages.unshift({
          role: 'system',
          content: `You are a helpful assistant. Use this current information in your response: ${contextData}`
        });
      }
  
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages: messages,
        stream: false
      }, {
        timeout: 60000
      });
  
      return response.data.message;
  
    } catch (error) {
      console.error('Ollama chat error:', error.message);
      throw new Error('Failed to chat with Ollama');
    }
  }
  
  
  /**
   * Chat with conversation history
   */
  async chat(messages) {
    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, {
        model: this.model,
        messages: messages,
        stream: false
      }, {
        timeout: 60000
      });

      return response.data.message;
    } catch (error) {
      console.error('Ollama chat error:', error.message);
      throw new Error('Failed to chat with Ollama');
    }
  }

  /**
   * Check if Ollama is running and model is available
   */
  async healthCheck() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      const models = response.data.models || [];
      const modelExists = models.some(m => m.name === this.model);
      
      if (!modelExists) {
        console.warn(`⚠️  Model ${this.model} not found. Available models:`, models.map(m => m.name));
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Ollama health check failed:', error.message);
      return false;
    }
  }

  async extractCheckIntent(message) {
    const lower = message.toLowerCase();
    
    // Expanded keywords for better detection
    const checkKeywords = [
      'write check',
      'check for',
      'make check',
      'write a check',
      'help write check',
      'convert',
      'convert this',
      'convert to words',
      'number to words',
      'spell out'
    ];
    
    const hasCheckKeyword = checkKeywords.some(kw => lower.includes(kw));
    
    if (!hasCheckKeyword) {
      return { action: 'none' };
    }
  
    // Match patterns:
    // $2,630.30 or 2,630.30 or $2630.30 or 2630.30 or $2630 or 2630
    const patterns = [
      /\$\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/,  // $2,630.30
      /(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?)/,       // 2,630.30 (must have comma)
      /\$\s*(\d+(?:\.\d{1,2})?)/,                 // $2630.30
      /(?:^|\s)(\d{4,}(?:\.\d{1,2})?)(?:\s|$)/    // 2630.30 (4+ digits)
    ];
  
    let amountMatch = null;
    for (const pattern of patterns) {
      amountMatch = message.match(pattern);
      if (amountMatch) break;
    }
    
    console.log('🔍 Check detection debug:', {
      message: message,
      hasKeyword: hasCheckKeyword,
      rawMatch: amountMatch,
      extracted: amountMatch ? amountMatch[1] : null
    });
    
    if (amountMatch && amountMatch[1]) {
      const amount = amountMatch[1].replace(/,/g, ''); // Remove commas
      
      console.log('✅ Final extracted amount:', amount);
      
      return {
        action: 'write_check',
        amount: amount
      };
    }
  
    console.log('❌ No amount found in message');
    return { action: 'none' };
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

  async extractBillIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // Quick keyword check
    const billKeywords = ['bill', 'payment', 'pay', 'mortgage', 'credit card', 'loan', 'utility', 'due'];
    const hasBillKeyword = billKeywords.some(kw => lowerMsg.includes(kw));
    
    if (!hasBillKeyword) {
      return { action: 'none' };
    }
  
    const prompt = `Analyze this message for bill/payment intent. Return ONLY a JSON object:
  
  {
    "action": "pay|check_due|add|list|cashflow|none",
    "billName": "name or null",
    "amount": "amount as number or null",
    "timeframe": "today|week|month|null"
  }
  
  Examples:
  "I paid the mortgage" -> {"action":"pay","billName":"mortgage","amount":null,"timeframe":null}
  "What bills are due today?" -> {"action":"check_due","billName":null,"amount":null,"timeframe":"today"}
  "Do I have enough to pay today's bills?" -> {"action":"cashflow","billName":null,"amount":null,"timeframe":"today"}
  "What bills do I need to pay this week?" -> {"action":"check_due","billName":null,"amount":null,"timeframe":"week"}
  "List all my bills" -> {"action":"list","billName":null,"amount":null,"timeframe":null}
  "I paid the credit card $2500" -> {"action":"pay","billName":"credit card","amount":2500,"timeframe":null}
  
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
      console.error('Failed to parse bill intent:', error.message);
      return { action: 'none' };
    }
  }

  /**
   * Extract tasks/reminders from user message
   */
  async extractTasks(message) {
    const prompt = `Extract any tasks, reminders, or important things to remember from this message. Return ONLY a JSON array of tasks with this format: [{"task": "description", "dueDate": "YYYY-MM-DD or null"}]. If there are no tasks, return an empty array [].

User message: "${message}"

JSON array:`;

    const response = await this.generate(prompt);
    
    try {
      // Try to extract JSON from response
      const jsonMatch = response.response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return [];
    } catch (error) {
      console.error('Failed to parse tasks:', error.message);
      return [];
    }
  }

  /**
   * Detect calendar intent and extract details from user message
   */
  async extractCalendarIntent(message) {
    const lowerMsg = message.toLowerCase();
    
    // MUST have calendar-specific keywords
    const calendarKeywords = [
      'calendar',
      'schedule',
      'meeting',
      'appointment',
      'event',
      'what do i have',
      "what's on my",
      'free time',
      'available'
    ];
    
    // Exclude if it has bill keywords
    const billKeywords = ['bill', 'pay', 'payment', 'mortgage', 'loan', 'credit card', 'utility', 'due'];
    const hasBillKeyword = billKeywords.some(keyword => lowerMsg.includes(keyword));
    
    if (hasBillKeyword) {
      return { action: 'none' };
    }
    
    // Check if message contains calendar keywords
    const hasCalendarKeyword = calendarKeywords.some(keyword => lowerMsg.includes(keyword));
    
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
  "What do I have today?" -> {"action":"view","when":"today","summary":null,"time":null,"duration":null,"details":null}
  
  IMPORTANT: Only return calendar actions for actual calendar/schedule requests. Bill or payment questions should return "none".
  
  Today's date is ${today}. User message: "${message}"
  
  JSON object:`;
  
    const response = await this.generate(prompt);
    
    try {
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
}