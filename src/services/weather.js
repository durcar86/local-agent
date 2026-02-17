import axios from 'axios';

export class WeatherService {
  constructor(config) {
    this.city = config.location?.city || 'New York';
    this.country = config.location?.country || 'US';
  }

  async getCurrentWeather() {
    try {
      // Using wttr.in - no API key required
      const response = await axios.get(
        `https://wttr.in/${this.city}?format=j1`,
        { timeout: 5000,
          headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'application/json',
            'Referer': 'https://wttr.in'
          } }
      );

      const current = response.data.current_condition[0];
      const weather = response.data.weather[0];

      const data = {
        location: this.city,
        temperature_f: parseInt(current.temp_F),
        temperature_c: parseInt(current.temp_C),
        feels_like_f: parseInt(current.FeelsLikeF),
        feels_like_c: parseInt(current.FeelsLikeC),
        condition: current.weatherDesc[0].value,
        humidity: parseInt(current.humidity),
        wind_speed_mph: parseInt(current.windspeedMiles),
        wind_direction: current.winddir16Point,
        precipitation_mm: parseFloat(current.precipMM),
        uv_index: parseInt(current.uvIndex),
        high_f: parseInt(weather.maxtempF),
        low_f: parseInt(weather.mintempF)
      };

      return data;
    } catch (error) {
      console.error('Weather fetch error:', error.message);
      return null;
    }
  }

  formatWeatherForLLM(weatherData) {
    if (!weatherData) {
      return "Weather data is currently unavailable.";
    }

    return `Current weather in ${weatherData.location}: ` +
      `Temperature is ${weatherData.temperature_f}°F (feels like ${weatherData.feels_like_f}°F), ` +
      `Conditions: ${weatherData.condition}, ` +
      `Humidity: ${weatherData.humidity}%, ` +
      `Wind: ${weatherData.wind_speed_mph} mph ${weatherData.wind_direction}, ` +
      `High: ${weatherData.high_f}°F, Low: ${weatherData.low_f}°F, ` +
      `UV Index: ${weatherData.uv_index}.`;
  }

  formatWeatherForUser(weatherData) {
    if (!weatherData) {
      return "❌ Weather data is currently unavailable.";
    }

    return `🌤️ Weather in ${weatherData.location}:\n\n` +
      `🌡️ Temperature: ${weatherData.temperature_f}°F (feels like ${weatherData.feels_like_f}°F)\n` +
      `☁️ Conditions: ${weatherData.condition}\n` +
      `💧 Humidity: ${weatherData.humidity}%\n` +
      `💨 Wind: ${weatherData.wind_speed_mph} mph ${weatherData.wind_direction}\n` +
      `📊 High/Low: ${weatherData.high_f}°F / ${weatherData.low_f}°F\n` +
      `☀️ UV Index: ${weatherData.uv_index}`;
  }
}