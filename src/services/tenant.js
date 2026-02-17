import { readFileSync, writeFileSync, existsSync } from 'fs';

export class TenantService {
  constructor(tenantsFilePath = './tenants.json') {
    this.tenantsFilePath = tenantsFilePath;
    this.tenants = this.loadTenants();
  }

  loadTenants() {
    if (existsSync(this.tenantsFilePath)) {
      try {
        return JSON.parse(readFileSync(this.tenantsFilePath, 'utf-8'));
      } catch (error) {
        console.error('Error loading tenants file:', error.message);
      }
    }
    
    return {
      tenants: [],
      messageTemplates: this.getDefaultTemplates(),
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    };
  }

  saveTenants() {
    try {
      this.tenants.metadata.lastUpdated = new Date().toISOString();
      writeFileSync(this.tenantsFilePath, JSON.stringify(this.tenants, null, 2));
    } catch (error) {
      console.error('Error saving tenants:', error.message);
    }
  }

  getDefaultTemplates() {
    return {
      rentReminder: "Just a friendly reminder that your rent of $[AMOUNT] is due on [DUE_DATE]. You can make the payment through [PAYMENT_METHOD]. Thank you for your cooperation in advance.",
      
      rentReminderFriendly: "We hope you're doing well! Your rent of $[AMOUNT] is due on [DUE_DATE]. We appreciate your timely payments, and if you have any questions, feel free to reach out. Thanks for being a great tenant!",
      
      paymentReceived: "Received your rent payment. Thank you for your promptness!",
      
      latePaymentPolicy: "Thank you for the message and heads up. I can accept a check if the banking app is not working. Our lease agreement states there is a 5 day grace period before a late charge of $50 + $10 per day is added. Let me know.",
      
      monthlyCheckIn: "Hi [NAME]! Hope everything is going well with the property. Just checking in to see if there are any maintenance issues or concerns. Your rent of $[AMOUNT] is due on [DUE_DATE]. Thanks for being a great tenant!"
    };
  }

  addTenant(tenantData) {
    const tenant = {
      id: Date.now().toString(),
      name: tenantData.name,
      phone: tenantData.phone,
      property: tenantData.property || '',
      rentAmount: tenantData.rentAmount,
      rentDueDay: tenantData.rentDueDay || 1,
      paymentMethod: tenantData.paymentMethod || 'bank transfer',
      notes: tenantData.notes || '',
      lastReminderSent: null,
      paymentHistory: [],
      createdAt: new Date().toISOString()
    };
    
    this.tenants.tenants.push(tenant);
    this.saveTenants();
    return tenant;
  }

  getAllTenants() {
    return this.tenants.tenants;
  }

  recordPayment(tenantId, amount, paymentType = 'full', date = null) {
    const tenant = this.tenants.tenants.find(t => t.id === tenantId);
    if (!tenant) return false;
  
    const paymentDate = date || new Date().toISOString();
    const paymentMonth = new Date(paymentDate).toISOString().slice(0, 7); // "2024-02"
  
    const payment = {
      id: Date.now().toString(),
      amount: amount,
      type: paymentType, // 'full', 'partial', 'late'
      date: paymentDate,
      month: paymentMonth,
      recordedAt: new Date().toISOString()
    };
  
    if (!tenant.paymentHistory) {
      tenant.paymentHistory = [];
    }
  
    tenant.paymentHistory.push(payment);
    this.saveTenants();
    return payment;
  }
  
  hasPaymentForMonth(tenantId, monthString = null) {
    const tenant = this.tenants.tenants.find(t => t.id === tenantId);
    if (!tenant || !tenant.paymentHistory) return null;
  
    // Use current month if not specified
    const targetMonth = monthString || new Date().toISOString().slice(0, 7);
  
    // Find all payments for this month
    const monthPayments = tenant.paymentHistory.filter(p => p.month === targetMonth);
    
    if (monthPayments.length === 0) {
      return null;
    }
  
    // Calculate total paid this month
    const totalPaid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    
    // Check if fully paid
    const isPaidFull = totalPaid >= tenant.rentAmount;
    const isPartial = totalPaid > 0 && totalPaid < tenant.rentAmount;
  
    return {
      paid: isPaidFull,
      partial: isPartial,
      totalPaid: totalPaid,
      remaining: tenant.rentAmount - totalPaid,
      payments: monthPayments
    };
  }
  
  getTenantByName(name) {
    const lowerName = name.toLowerCase();
    return this.tenants.tenants.find(t => 
      t.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(t.name.toLowerCase())
    );
  }
  
  getPaymentStatus() {
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    return this.tenants.tenants.map(tenant => {
      const status = this.hasPaymentForMonth(tenant.id, currentMonth);
      
      return {
        tenant: tenant,
        status: status ? (status.paid ? 'paid' : 'partial') : 'unpaid',
        details: status
      };
    });
  }
  
  generateRentReminder(tenantId, templateName = 'rentReminder') {
    const tenant = this.tenants.tenants.find(t => t.id === tenantId);
    if (!tenant) return null;
  
    // Make template name case-insensitive
    let template = this.tenants.messageTemplates[templateName];
    
    // If not found, try to find case-insensitive match
    if (!template) {
      const lowerTemplateName = templateName.toLowerCase();
      const matchedKey = Object.keys(this.tenants.messageTemplates).find(
        key => key.toLowerCase() === lowerTemplateName
      );
      
      if (matchedKey) {
        template = this.tenants.messageTemplates[matchedKey];
      }
    }
  
    if (!template) {
      console.error(`Template '${templateName}' not found. Available: ${Object.keys(this.tenants.messageTemplates).join(', ')}`);
      return null;
    }
  
    const today = new Date();
    const dueDate = new Date(today.getFullYear(), today.getMonth(), tenant.rentDueDay);
    
    if (dueDate < today) {
      dueDate.setMonth(dueDate.getMonth() + 1);
    }
  
    const dueDateStr = dueDate.toLocaleDateString('en-US', { 
      month: 'long', 
      day: 'numeric'
    });
  
    let message = template
      .replace(/\[NAME\]/g, tenant.name.split(' ')[0])
      .replace(/\[AMOUNT\]/g, tenant.rentAmount.toFixed(2))
      .replace(/\[DUE_DATE\]/g, dueDateStr)
      .replace(/\[PAYMENT_METHOD\]/g, tenant.paymentMethod);
  
    return { tenant, message, dueDate: dueDate.toISOString().split('T')[0] };
  }

  generateAllRentReminders(templateName = 'rentReminder') {
    return this.tenants.tenants.map(tenant => 
      this.generateRentReminder(tenant.id, templateName)
    ).filter(r => r !== null);
  }

  markReminderSent(tenantId) {
    const tenant = this.tenants.tenants.find(t => t.id === tenantId);
    if (tenant) {
      tenant.lastReminderSent = new Date().toISOString();
      this.saveTenants();
      return true;
    }
    return false;
  }

  getRentReminderSummary() {
    const tenants = this.getAllTenants();
    if (tenants.length === 0) {
      return "You don't have any tenants added yet.";
    }
  
    const today = new Date();
    const currentDay = today.getDate();
    const daysBeforeReminder = 5; // Check 5 days ahead
  
    const dueToday = [];
    const dueSoon = [];
  
    for (const tenant of tenants) {
      const dueDay = tenant.rentDueDay;
      
      if (dueDay === currentDay) {
        dueToday.push(tenant);
      } else if (dueDay > currentDay && dueDay <= currentDay + daysBeforeReminder) {
        const daysUntil = dueDay - currentDay;
        dueSoon.push({ tenant, daysUntil });
      } else if (dueDay < currentDay) {
        // Handle month wrapping
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysUntil = (daysInMonth - currentDay) + dueDay;
        
        if (daysUntil <= daysBeforeReminder) {
          dueSoon.push({ tenant, daysUntil });
        }
      }
    }
  
    const lines = [];
  
    if (dueToday.length > 0) {
      lines.push('🏠 RENT DUE TODAY:');
      dueToday.forEach(t => {
        lines.push(`  • ${t.name}: $${t.rentAmount} (${t.paymentMethod})`);
      });
      lines.push('');
    }
  
    if (dueSoon.length > 0) {
      lines.push('📅 Rent Due Soon:');
      dueSoon.sort((a, b) => a.daysUntil - b.daysUntil);
      dueSoon.forEach(({ tenant, daysUntil }) => {
        lines.push(`  • ${tenant.name}: ${daysUntil} day${daysUntil > 1 ? 's' : ''} ($${tenant.rentAmount})`);
      });
      lines.push('');
    }
  
    if (lines.length === 0) {
      return `You have ${tenants.length} tenant(s), but no rent payments are due in the next ${daysBeforeReminder} days.`;
    }
  
    lines.push('Use /rentreminder to generate messages.');
    return lines.join('\n');
  }

  async generateLLMReply(tenantMessage, ollamaService) {
    const prompt = `You are a friendly landlord responding to a tenant message. Be professional, helpful, and empathetic.

Tenant message: "${tenantMessage}"

Generate a helpful response:`;

    const response = await ollamaService.generate(prompt);
    return response.response;
  }
}