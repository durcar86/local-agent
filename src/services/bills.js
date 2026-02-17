import { readFileSync, writeFileSync, existsSync } from 'fs';

export class BillsService {
  constructor(billsFilePath = './src/data/bills.json') {
    this.billsFilePath = billsFilePath;
    this.bills = this.loadBills();
  }

  loadBills() {
    console.log('📂 Looking for bills file at:', this.billsFilePath);
    
    if (existsSync(this.billsFilePath)) {
      console.log('✅ Bills file found!');
      try {
        const data = JSON.parse(readFileSync(this.billsFilePath, 'utf-8'));
        console.log('📊 Loaded bills:', {
          recurring: data.recurringBills?.length || 0,
          onetime: data.oneTimeBills?.length || 0
        });
        return data;
      } catch (error) {
        console.error('❌ Error loading bills file:', error.message);
      }
    } else {
      console.log('⚠️  Bills file not found, creating default structure');
    }
    
    return {
      recurringBills: [],
      oneTimeBills: [],
      upcomingExpenses: [],
      accounts: [],
      paymentHistory: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    };
  }

  saveBills() {
    try {
      this.bills.metadata.lastUpdated = new Date().toISOString();
      writeFileSync(this.billsFilePath, JSON.stringify(this.bills, null, 2));
    } catch (error) {
      console.error('Error saving bills:', error.message);
    }
  }

  addRecurringBill(billData) {
    const bill = {
      id: Date.now().toString(),
      name: billData.name,
      category: billData.category, // mortgage, credit_card, loan, utility, insurance, subscription, tax, payroll
      amount: billData.amount, // null if variable
      isVariable: billData.isVariable || false,
      frequency: billData.frequency, // monthly, weekly, biweekly, quarterly, annual
      dueDay: billData.dueDay, // day of month (1-31) or day of week for weekly
      autopay: billData.autopay || false,
      autopayAccount: billData.autopayAccount || null,
      paymentAccount: billData.paymentAccount || 'business_checking',
      paymentMethod: billData.paymentMethod || 'ACH',
      notes: billData.notes || '',
      active: true,
      createdAt: new Date().toISOString()
    };
    
    this.bills.recurringBills.push(bill);
    this.saveBills();
    return bill;
  }

  addUpcomingExpense(expenseData) {
    const expense = {
      id: Date.now().toString(),
      name: expenseData.name,
      category: expenseData.category, // tax, license, maintenance, seasonal, legal, etc.
      amount: expenseData.amount,
      currentlyReserved: expenseData.currentlyReserved || 0, // How much you've set aside
      dueDate: expenseData.dueDate, // YYYY-MM-DD
      priority: expenseData.priority || 'medium', // high, medium, low
      notes: expenseData.notes || '',
      paid: false,
      createdAt: new Date().toISOString()
    };
    
    if (!this.bills.upcomingExpenses) {
      this.bills.upcomingExpenses = [];
    }
    
    this.bills.upcomingExpenses.push(expense);
    this.saveBills();
    return expense;
  }
  
  reserveFunds(expenseId, amount) {
    const expense = this.bills.upcomingExpenses.find(e => e.id === expenseId);
    if (!expense) return false;
  
    expense.currentlyReserved += amount;
  
    // Check if fully reserved
    if (expense.currentlyReserved >= expense.amount) {
      expense.fullyReserved = true;
    }
  
    this.saveBills();
    return expense;
  }
  
  getUpcomingExpensesSummary() {
    const active = this.bills.upcomingExpenses?.filter(e => !e.paid) || [];
    
    if (active.length === 0) {
      return null;
    }
  
    const today = new Date();
    const urgent = []; // Due within 30 days
    const upcoming = []; // Due 31-90 days
    const future = []; // Due 90+ days
  
    active.forEach(expense => {
      const dueDate = new Date(expense.dueDate);
      const daysUntilDue = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
      
      const reserved = (expense.currentlyReserved / expense.amount) * 100;
      const stillNeeded = expense.amount - expense.currentlyReserved;
  
      const expenseWithStatus = {
        ...expense,
        daysUntilDue,
        percentReserved: Math.min(100, reserved),
        stillNeeded,
        isUrgent: daysUntilDue <= 30
      };
  
      if (daysUntilDue <= 30) {
        urgent.push(expenseWithStatus);
      } else if (daysUntilDue <= 90) {
        upcoming.push(expenseWithStatus);
      } else {
        future.push(expenseWithStatus);
      }
    });
  
    return {
      urgent: urgent.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      upcoming: upcoming.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      future: future.sort((a, b) => a.daysUntilDue - b.daysUntilDue),
      totalAmount: active.reduce((sum, e) => sum + e.amount, 0),
      totalReserved: active.reduce((sum, e) => sum + e.currentlyReserved, 0),
      totalStillNeeded: active.reduce((sum, e) => sum + (e.amount - e.currentlyReserved), 0)
    };
  }
  
  getUpcomingExpenseByName(name) {
    const lowerName = name.toLowerCase();
    return this.bills.upcomingExpenses?.find(e => 
      e.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(e.name.toLowerCase())
    );
  }

  addOneTimeBill(billData) {
    const bill = {
      id: Date.now().toString(),
      name: billData.name,
      category: billData.category,
      amount: billData.amount,
      dueDate: billData.dueDate, // YYYY-MM-DD
      autopay: false,
      paymentAccount: billData.paymentAccount || 'business_checking',
      paymentMethod: billData.paymentMethod || 'ACH',
      notes: billData.notes || '',
      paid: false,
      createdAt: new Date().toISOString()
    };
    
    this.bills.oneTimeBills.push(bill);
    this.saveBills();
    return bill;
  }

  recordPayment(billId, amount, paymentDate = null, isRecurring = true) {
    const payment = {
      id: Date.now().toString(),
      billId: billId,
      amount: amount,
      paymentDate: paymentDate || new Date().toISOString(),
      month: new Date(paymentDate || new Date()).toISOString().slice(0, 7),
      recordedAt: new Date().toISOString()
    };

    this.bills.paymentHistory.push(payment);

    // Mark one-time bill as paid
    if (!isRecurring) {
      const bill = this.bills.oneTimeBills.find(b => b.id === billId);
      if (bill) {
        bill.paid = true;
        bill.paidDate = payment.paymentDate;
      }
    }

    this.saveBills();
    return payment;
  }

  hasPaymentForMonth(billId, monthString = null) {
    const targetMonth = monthString || new Date().toISOString().slice(0, 7);
    return this.bills.paymentHistory.some(p => 
      p.billId === billId && p.month === targetMonth
    );
  }

  getBillsDueToday() {
    const today = new Date();
    const currentDay = today.getDate();
    const todayString = today.toISOString().split('T')[0];
    const currentMonth = today.toISOString().slice(0, 7);

    const dueToday = [];

    // Check recurring bills
    this.bills.recurringBills.forEach(bill => {
      if (!bill.active) return;

      let isDue = false;

      if (bill.frequency === 'monthly' && bill.dueDay === currentDay) {
        isDue = true;
      } else if (bill.frequency === 'weekly') {
        // Check day of week
        const dayOfWeek = today.getDay(); // 0 = Sunday
        if (bill.dueDay === dayOfWeek) {
          isDue = true;
        }
      }

      if (isDue) {
        const alreadyPaid = this.hasPaymentForMonth(bill.id, currentMonth);
        
        dueToday.push({
          ...bill,
          type: 'recurring',
          paid: alreadyPaid,
          needsAction: !bill.autopay && !alreadyPaid
        });
      }
    });

    // Check one-time bills
    this.bills.oneTimeBills.forEach(bill => {
      if (bill.dueDate === todayString && !bill.paid) {
        dueToday.push({
          ...bill,
          type: 'onetime',
          needsAction: !bill.autopay
        });
      }
    });

    return dueToday;
  }

  getBillsDueInDays(days) {
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + days);
    
    const futureDay = futureDate.getDate();
    const futureDateString = futureDate.toISOString().split('T')[0];
    const currentMonth = today.toISOString().slice(0, 7);

    const dueSoon = [];

    // Check recurring bills
    this.bills.recurringBills.forEach(bill => {
      if (!bill.active) return;

      let isDue = false;

      if (bill.frequency === 'monthly' && bill.dueDay === futureDay) {
        isDue = true;
      }

      if (isDue) {
        const alreadyPaid = this.hasPaymentForMonth(bill.id, currentMonth);
        
        dueSoon.push({
          ...bill,
          type: 'recurring',
          daysUntil: days,
          paid: alreadyPaid,
          needsAction: !bill.autopay && !alreadyPaid
        });
      }
    });

    // Check one-time bills
    this.bills.oneTimeBills.forEach(bill => {
      if (bill.dueDate === futureDateString && !bill.paid) {
        dueSoon.push({
          ...bill,
          type: 'onetime',
          daysUntil: days,
          needsAction: !bill.autopay
        });
      }
    });

    return dueSoon;
  }

  getBillsInDateRange(startDate, endDate) {
    const bills = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Iterate through each day in range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayBills = this.getBillsDueOnDate(d);
      bills.push(...dayBills);
    }

    return bills;
  }

  getBillsDueOnDate(date) {
    const targetDate = new Date(date);
    const targetDay = targetDate.getDate();
    const targetDateString = targetDate.toISOString().split('T')[0];
    const targetMonth = targetDate.toISOString().slice(0, 7);

    const bills = [];

    // Check recurring bills
    this.bills.recurringBills.forEach(bill => {
      if (!bill.active) return;

      if (bill.frequency === 'monthly' && bill.dueDay === targetDay) {
        const alreadyPaid = this.hasPaymentForMonth(bill.id, targetMonth);
        bills.push({
          ...bill,
          type: 'recurring',
          dueDate: targetDateString,
          paid: alreadyPaid,
          needsAction: !bill.autopay && !alreadyPaid
        });
      }
    });

    // Check one-time bills
    this.bills.oneTimeBills.forEach(bill => {
      if (bill.dueDate === targetDateString) {
        bills.push({
          ...bill,
          type: 'onetime',
          needsAction: !bill.autopay && !bill.paid
        });
      }
    });

    return bills;
  }

  calculateTotalDue(bills) {
    let total = 0;
    let estimatedVariableTotal = 0;
    let needsAction = 0;
    let autopayTotal = 0;

    bills.forEach(bill => {
      if (bill.isVariable) {
        // Use last payment amount as estimate, or 0 if no history
        const lastPayment = this.getLastPaymentAmount(bill.id);
        estimatedVariableTotal += lastPayment || 0;
      } else if (bill.amount) {
        total += bill.amount;
        
        if (bill.autopay) {
          autopayTotal += bill.amount;
        }
      }

      if (bill.needsAction) {
        needsAction++;
      }
    });

    return {
      fixed: total,
      estimatedVariable: estimatedVariableTotal,
      total: total + estimatedVariableTotal,
      autopay: autopayTotal,
      manual: total - autopayTotal,
      billsNeedingAction: needsAction
    };
  }

  getLastPaymentAmount(billId) {
    const payments = this.bills.paymentHistory
      .filter(p => p.billId === billId)
      .sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    
    return payments.length > 0 ? payments[0].amount : null;
  }

  getBillByName(name) {
    const lowerName = name.toLowerCase();
    
    let bill = this.bills.recurringBills.find(b => 
      b.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(b.name.toLowerCase())
    );
    
    if (bill) return { ...bill, type: 'recurring' };
    
    bill = this.bills.oneTimeBills.find(b => 
      b.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(b.name.toLowerCase())
    );
    
    return bill ? { ...bill, type: 'onetime' } : null;
  }

  getAllActiveBills() {
    const recurring = this.bills.recurringBills.filter(b => b.active);
    const onetime = this.bills.oneTimeBills.filter(b => !b.paid);
    
    return {
      recurring: recurring,
      onetime: onetime,
      total: recurring.length + onetime.length
    };
  }

  getMonthlyTotal() {
    let total = 0;
    
    this.bills.recurringBills.forEach(bill => {
      if (!bill.active) return;
      
      if (bill.frequency === 'monthly' && !bill.isVariable) {
        total += bill.amount || 0;
      } else if (bill.frequency === 'weekly') {
        // Estimate 4.33 weeks per month
        total += (bill.amount || 0) * 4.33;
      } else if (bill.frequency === 'quarterly') {
        total += (bill.amount || 0) / 3;
      } else if (bill.frequency === 'annual') {
        total += (bill.amount || 0) / 12;
      }
    });

    return total;
  }
}