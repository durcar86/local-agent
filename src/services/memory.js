import { readFileSync, writeFileSync, existsSync } from 'fs';

export class MemoryService {
  constructor(memoryFilePath = './memory.json') {
    this.memoryFilePath = memoryFilePath;
    this.memory = this.loadMemory();
  }

  loadMemory() {
    if (existsSync(this.memoryFilePath)) {
      try {
        return JSON.parse(readFileSync(this.memoryFilePath, 'utf-8'));
      } catch (error) {
        console.error('Error loading memory file:', error.message);
      }
    }
    
    return {
      messages: [],
      tasks: [],
      metadata: {
        created: new Date().toISOString(),
        lastUpdated: new Date().toISOString()
      }
    };
  }

  saveMemory() {
    try {
      this.memory.metadata.lastUpdated = new Date().toISOString();
      writeFileSync(this.memoryFilePath, JSON.stringify(this.memory, null, 2));
    } catch (error) {
      console.error('Error saving memory:', error.message);
    }
  }

  addMessage(role, content) {
    const message = {
      role: role, // 'user' or 'assistant'
      content: content,
      timestamp: new Date().toISOString()
    };
    
    this.memory.messages.push(message);
    
    // Keep only last 100 messages to prevent file from growing too large
    if (this.memory.messages.length > 100) {
      this.memory.messages = this.memory.messages.slice(-100);
    }
    
    this.saveMemory();
  }

  getRecentMessages(count = 10) {
    return this.memory.messages.slice(-count);
  }

  clearMessages() {
    this.memory.messages = [];
    this.saveMemory();
  }

  addTask(task) {
    const newTask = {
      id: Date.now().toString(),
      task: task.task,
      dueDate: task.dueDate || null,
      completed: false,
      createdAt: new Date().toISOString()
    };
    
    this.memory.tasks.push(newTask);
    this.saveMemory();
    return newTask;
  }

  getTasks(includeCompleted = false) {
    if (includeCompleted) {
      return this.memory.tasks;
    }
    return this.memory.tasks.filter(t => !t.completed);
  }

  completeTask(taskId) {
    const task = this.memory.tasks.find(t => t.id === taskId);
    if (task) {
      task.completed = true;
      task.completedAt = new Date().toISOString();
      this.saveMemory();
      return true;
    }
    return false;
  }

  deleteTask(taskId) {
    const index = this.memory.tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      this.memory.tasks.splice(index, 1);
      this.saveMemory();
      return true;
    }
    return false;
  }

  searchMessages(query) {
    return this.memory.messages.filter(m => 
      m.content.toLowerCase().includes(query.toLowerCase())
    );
  }

  getStats() {
    return {
      totalMessages: this.memory.messages.length,
      totalTasks: this.memory.tasks.length,
      completedTasks: this.memory.tasks.filter(t => t.completed).length,
      pendingTasks: this.memory.tasks.filter(t => !t.completed).length,
      created: this.memory.metadata.created,
      lastUpdated: this.memory.metadata.lastUpdated
    };
  }
}
