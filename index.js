require('dotenv').config();
const express = require('express');
const axios = require('axios');
const app = express();

const WEATHER_ICONS = {
  '01': '☀️',
  '02': '☁️',
  '03': '☁️',
  '04': '☁️',
  '09': '🌧️',
  '10': '🌧️',
  '11': '⛈️',
  '13': '❄️',
  '50': '🌫️'
};

function formatTime(timestamp) {
  const date = new Date(timestamp * 1000);
  
  // Ajustar a UTC-3 (Argentina)
  const argentinaTime = new Date(date.getTime() - (3 * 60 * 60 * 1000));
  
  return argentinaTime.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  .replace('a. m.', 'AM')
  .replace('p. m.', 'PM');
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000)
    .toLocaleDateString('es-AR', { weekday: 'long' })
    .replace(/^\w/, c => c.toUpperCase());
}

function capitalizeFirst(str) {
  return str.replace(/^\w/, c => c.toUpperCase());
}

app.get('/weather', async (req, res) => {
  try {
    const response = await axios.get('https://api.openweathermap.org/data/3.0/onecall', {
      params: {
        lat: req.query.lat || process.env.DEFAULT_LAT,
        lon: req.query.lon || process.env.DEFAULT_LON,
        appid: process.env.OPENWEATHER_API_KEY,
        units: 'metric',
        lang: 'es',
        exclude: 'hourly,minutely'
      }
    });

    const current = response.data.current;
    const daily = response.data.daily;

    const weatherData = {
      current: {
        icon: getWeatherIcon(current.weather[0].icon),
        condition: capitalizeFirst(current.weather[0].description),
        temp_min: daily[0].temp.min.toFixed(1),
        temp_max: daily[0].temp.max.toFixed(1),
        humidity: current.humidity,
        wind_speed: current.wind_speed,
        uvi: current.uvi,
        sunrise: formatTime(current.sunrise),
        sunset: formatTime(current.sunset),
        rain: current.rain?.['1h'] || 0
      },
      forecast: [
        {
          day: formatDate(daily[1].dt),
          icon: getWeatherIcon(daily[1].weather[0].icon),
          temp_min: daily[1].temp.min.toFixed(1),
          temp_max: daily[1].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[2].dt),
          icon: getWeatherIcon(daily[2].weather[0].icon),
          temp_min: daily[2].temp.min.toFixed(1),
          temp_max: daily[2].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[3].dt),
          icon: getWeatherIcon(daily[3].weather[0].icon),
          temp_min: daily[3].temp.min.toFixed(1),
          temp_max: daily[3].temp.max.toFixed(1)
        },
        {
          day: formatDate(daily[4].dt),
          icon: getWeatherIcon(daily[4].weather[0].icon),
          temp_min: daily[4].temp.min.toFixed(1),
          temp_max: daily[4].temp.max.toFixed(1)
        }
      ],
      formatted_message: `El clima para hoy en tu ubicación es:
• ${getWeatherIcon(current.weather[0].icon)} Condición: ${capitalizeFirst(current.weather[0].description)}
• 🌡️ Temperatura: ${daily[0].temp.min.toFixed(1)} °C - ${daily[0].temp.max.toFixed(1)} °C
• 💧 Humedad: ${current.humidity}%
• 💨 Velocidad viento: ${current.wind_speed} km/h
• ☀️ Indice UV: ${current.uvi}
• 🌅 Amanecer: ${formatTime(current.sunrise)}
• 🌇 Atardecer: ${formatTime(current.sunset)}
${current.rain ? `• 🌧️ Lluvia última hora: ${current.rain['1h']}mm\n` : ''}
Pronóstico de 4 días:
• *${formatDate(daily[1].dt)}*: ${getWeatherIcon(daily[1].weather[0].icon)} ${daily[1].temp.min.toFixed(1)}°C - ${daily[1].temp.max.toFixed(1)}°C
• *${formatDate(daily[2].dt)}*: ${getWeatherIcon(daily[2].weather[0].icon)} ${daily[2].temp.min.toFixed(1)}°C - ${daily[2].temp.max.toFixed(1)}°C
• *${formatDate(daily[3].dt)}*: ${getWeatherIcon(daily[3].weather[0].icon)} ${daily[3].temp.min.toFixed(1)}°C - ${daily[3].temp.max.toFixed(1)}°C
• *${formatDate(daily[4].dt)}*: ${getWeatherIcon(daily[4].weather[0].icon)} ${daily[4].temp.min.toFixed(1)}°C - ${daily[4].temp.max.toFixed(1)}°C`
};

    res.json(weatherData);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del clima' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

function getWeatherIcon(iconCode) {
  const iconPrefix = iconCode.slice(0, 2);
  return WEATHER_ICONS[iconPrefix] || '❓';
}