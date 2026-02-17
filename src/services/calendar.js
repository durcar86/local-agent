import { readFileSync, writeFileSync, existsSync } from 'fs';

let google, authenticate;

// Try to import Google Calendar dependencies (optional)
try {
  const googleApis = await import('googleapis');
  const localAuth = await import('@google-cloud/local-auth');
  google = googleApis.google;
  authenticate = localAuth.authenticate;
} catch (error) {
  console.warn('⚠️  Google Calendar dependencies not installed. Calendar features will be disabled.');
  console.log('   To enable: npm install googleapis @google-cloud/local-auth');
}

export class CalendarService {
  constructor(config) {
    this.credentialsPath = config.credentialsPath;
    this.tokenPath = config.tokenPath;
    this.calendar = null;
    this.enabled = !!google;
    this.timezone = config.timezone || 'America/New_York';
  }

  /**
   * Initialize Google Calendar API
   */
  async initialize() {
    if (!this.enabled) {
      console.warn('⚠️  Google Calendar not available (missing dependencies)');
      return false;
    }

    try {
      if (!existsSync(this.credentialsPath)) {
        console.warn('⚠️  Google Calendar credentials not found. Calendar features will be disabled.');
        console.log('   To enable: Download credentials.json from Google Cloud Console');
        return false;
      }

      let auth;
      
      // Load saved token if exists
      if (existsSync(this.tokenPath)) {
        const token = JSON.parse(readFileSync(this.tokenPath, 'utf-8'));
        const credentials = JSON.parse(readFileSync(this.credentialsPath, 'utf-8'));
        
        const { client_secret, client_id, redirect_uris } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
        oAuth2Client.setCredentials(token);
        auth = oAuth2Client;
      } else {
        // First time auth
        auth = await authenticate({
          keyfilePath: this.credentialsPath,
          scopes: ['https://www.googleapis.com/auth/calendar']
        });
        
        // Save token
        writeFileSync(this.tokenPath, JSON.stringify(auth.credentials));
      }

      this.calendar = google.calendar({ version: 'v3', auth });
      console.log('✅ Google Calendar initialized');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize Google Calendar:', error.message);
      return false;
    }
  }

  /**
   * Get today's events
   */
  async getTodayEvents() {
    const today = new Date().toISOString().split('T')[0];
    return this.getEventsByDate(today);
  }

  /**
   * Get events for a specific date
   */
  async getEventsByDate(dateString) {
    if (!this.enabled) {
      return [];
    }
  
    if (!this.calendar) {
      await this.initialize();
    }
  
    if (!this.calendar) {
      return [];
    }
  
    const date = new Date(dateString + 'T00:00:00');
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
  
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: date.toISOString(),
        timeMax: nextDay.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        timeZone: this.timezone  // Use config timezone
      });
  
      const events = response.data.items || [];
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary,
        time: this.formatTime(event.start.dateTime || event.start.date),
        description: event.description || ''
      }));
    } catch (error) {
      console.error('Error fetching calendar events:', error.message);
      return [];
    }
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcomingEvents(days = 7) {
    if (!this.calendar) {
      await this.initialize();
    }

    if (!this.calendar) {
      return [];
    }

    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: now.toISOString(),
        timeMax: future.toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime'
      });

      const events = response.data.items || [];
      
      return events.map(event => ({
        id: event.id,
        summary: event.summary,
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        description: event.description || ''
      }));
    } catch (error) {
      console.error('Error fetching upcoming events:', error.message);
      return [];
    }
  }

  /**
   * Create a new calendar event
   */
  async createEvent(summary, startTime, endTime, description = '') {
    if (!this.calendar) {
      await this.initialize();
    }

    if (!this.calendar) {
      throw new Error('Calendar not initialized');
    }

    try {
      const event = {
        summary: summary,
        description: description,
        start: {
          dateTime: startTime,
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: endTime,
          timeZone: 'America/New_York'
        }
      };

      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event
      });

      return response.data;
    } catch (error) {
      console.error('Error creating calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Update an existing event
   */
  async updateEvent(eventId, updates) {
    if (!this.calendar) {
      await this.initialize();
    }

    if (!this.calendar) {
      throw new Error('Calendar not initialized');
    }

    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates
      });

      return response.data;
    } catch (error) {
      console.error('Error updating calendar event:', error.message);
      throw error;
    }
  }

  /**
   * Delete an event
   */
  async deleteEvent(eventId) {
    if (!this.calendar) {
      await this.initialize();
    }

    if (!this.calendar) {
      throw new Error('Calendar not initialized');
    }

    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
      
      return true;
    } catch (error) {
      console.error('Error deleting calendar event:', error.message);
      throw error;
    }
  }

  formatTime(dateTimeString) {
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  }
}
