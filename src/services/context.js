export class ContextService {
    constructor(config) {
      this.userPreferences = config.context || this.getDefaultPreferences();
    }
  
    getDefaultPreferences() {
      return {
        morningRoutine: {
          wakeTime: "07:00",
          breakfastTime: "08:00",
          workStart: "09:00"
        },
        afternoonRoutine: {
          lunchTime: "12:00",
          workoutTime: "15:00",
          workEnd: "17:00"
        },
        eveningRoutine: {
          dinnerTime: "18:30",
          windDownTime: "21:00",
          bedTime: "22:30"
        },
        habits: {
          breakfast: true,
          morningProtein: true,
          lunchProtein: true,
          workout: true,
          eveningRoutine: true
        }
      };
    }
  
    getTimeOfDay() {
      const hour = new Date().getHours();
      
      if (hour >= 5 && hour < 12) return 'morning';
      if (hour >= 12 && hour < 17) return 'afternoon';
      if (hour >= 17 && hour < 21) return 'evening';
      return 'night';
    }
  
    getCurrentPhase() {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      const hour = now.getHours();
      const minute = now.getMinutes();
  
      const phases = [
        {
          name: 'early_morning',
          start: this.userPreferences.morningRoutine.wakeTime,
          end: this.userPreferences.morningRoutine.breakfastTime,
          context: 'just waking up, getting ready for the day'
        },
        {
          name: 'breakfast_time',
          start: this.userPreferences.morningRoutine.breakfastTime,
          end: this.userPreferences.morningRoutine.workStart,
          context: 'breakfast time, morning nutrition'
        },
        {
          name: 'morning_work',
          start: this.userPreferences.morningRoutine.workStart,
          end: this.userPreferences.afternoonRoutine.lunchTime,
          context: 'focused work time'
        },
        {
          name: 'lunch_time',
          start: this.userPreferences.afternoonRoutine.lunchTime,
          end: '13:00',
          context: 'lunch break, midday nutrition'
        },
        {
          name: 'afternoon_work',
          start: '13:00',
          end: this.userPreferences.afternoonRoutine.workoutTime,
          context: 'afternoon productivity'
        },
        {
          name: 'workout_time',
          start: this.userPreferences.afternoonRoutine.workoutTime,
          end: '16:30',
          context: 'exercise and fitness time'
        },
        {
          name: 'post_workout',
          start: '16:30',
          end: this.userPreferences.afternoonRoutine.workEnd,
          context: 'post-workout recovery'
        },
        {
          name: 'evening_prep',
          start: this.userPreferences.afternoonRoutine.workEnd,
          end: this.userPreferences.eveningRoutine.dinnerTime,
          context: 'winding down from work, preparing for evening'
        },
        {
          name: 'dinner_time',
          start: this.userPreferences.eveningRoutine.dinnerTime,
          end: '19:30',
          context: 'dinner and evening meal'
        },
        {
          name: 'evening_relax',
          start: '19:30',
          end: this.userPreferences.eveningRoutine.windDownTime,
          context: 'relaxation and leisure time'
        },
        {
          name: 'wind_down',
          start: this.userPreferences.eveningRoutine.windDownTime,
          end: this.userPreferences.eveningRoutine.bedTime,
          context: 'preparing for sleep'
        },
        {
          name: 'sleep_time',
          start: this.userPreferences.eveningRoutine.bedTime,
          end: this.userPreferences.morningRoutine.wakeTime,
          context: 'rest and recovery'
        }
      ];
  
      for (const phase of phases) {
        const [startH, startM] = phase.start.split(':').map(Number);
        const [endH, endM] = phase.end.split(':').map(Number);
        
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        const currentMinutes = hour * 60 + minute;
  
        // Handle overnight phases
        if (endMinutes < startMinutes) {
          if (currentMinutes >= startMinutes || currentMinutes < endMinutes) {
            return phase;
          }
        } else {
          if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return phase;
          }
        }
      }
  
      return phases[0]; // Default to early morning
    }
  
    getContextualPrompts() {
      const phase = this.getCurrentPhase();
      const timeOfDay = this.getTimeOfDay();
  
      const prompts = {
        early_morning: [
          "Good morning! Have you had your coffee yet?",
          "Ready to tackle the day?",
          "Don't forget to hydrate first thing!"
        ],
        breakfast_time: [
          "Have you had breakfast yet?",
          "Remember to fuel up for the day!",
          "A good breakfast sets the tone for productivity.",
          "Don't skip the most important meal!"
        ],
        morning_work: [
          "How's your morning going so far?",
          "Staying focused?",
          "Remember to take short breaks."
        ],
        lunch_time: [
          "Time for lunch! Don't forget your protein.",
          "Have you eaten lunch yet?",
          "Fuel up for the afternoon ahead!",
          "A protein-rich lunch will keep you energized."
        ],
        afternoon_work: [
          "How's the afternoon treating you?",
          "Need a quick break?",
          "Stay hydrated!"
        ],
        workout_time: [
          "Ready for your workout?",
          "Time to get moving!",
          "Don't skip leg day! 💪",
          "Your fitness routine awaits!",
          "Are you ready for your exercise yet?"
        ],
        post_workout: [
          "How was your workout?",
          "Don't forget your post-workout protein!",
          "Great job on the workout!",
          "Remember to stretch and hydrate!"
        ],
        evening_prep: [
          "How was your day?",
          "Time to wind down from work.",
          "Any wins today?"
        ],
        dinner_time: [
          "Have you had dinner yet?",
          "Time for your evening meal!",
          "Don't forget to eat!"
        ],
        evening_relax: [
          "Enjoying your evening?",
          "Time to relax and unwind.",
          "How are you feeling?"
        ],
        wind_down: [
          "Getting ready for bed?",
          "Remember to wind down gradually.",
          "Prepare for a good night's rest."
        ],
        sleep_time: [
          "It's getting late - don't forget to get some rest!",
          "Sleep well!",
          "Time to recharge for tomorrow."
        ]
      };
  
      return {
        phase: phase.name,
        context: phase.context,
        suggestions: prompts[phase.name] || [],
        timeOfDay: timeOfDay
      };
    }
  
    buildContextualSystemPrompt() {
      const context = this.getContextualPrompts();
      const randomSuggestion = context.suggestions[Math.floor(Math.random() * context.suggestions.length)];
  
      return `You are a helpful personal assistant. Current time context: ${context.context}. 
  
  When appropriate, gently remind the user about their routine:
  - ${randomSuggestion}
  
  Be conversational, supportive, and helpful. Don't be pushy about routines, but mention them naturally when relevant.`;
    }
  }