/**
 * Lightweight weather service using Open-Meteo (free, no API key).
 * Only fetches for events within the next 7 days.
 * In-memory cache with 1-hour TTL.
 */

export interface WeatherData {
  tempHigh: number
  tempLow: number
  condition: string
  icon: string  // emoji
}

// WMO weather codes → condition + icon
const WMO_CONDITIONS: Record<number, { condition: string; icon: string }> = {
  0: { condition: 'Clear', icon: '☀️' },
  1: { condition: 'Mostly Clear', icon: '🌤️' },
  2: { condition: 'Partly Cloudy', icon: '⛅' },
  3: { condition: 'Overcast', icon: '☁️' },
  45: { condition: 'Foggy', icon: '🌫️' },
  48: { condition: 'Foggy', icon: '🌫️' },
  51: { condition: 'Light Drizzle', icon: '🌦️' },
  53: { condition: 'Drizzle', icon: '🌦️' },
  55: { condition: 'Heavy Drizzle', icon: '🌧️' },
  61: { condition: 'Light Rain', icon: '🌦️' },
  63: { condition: 'Rain', icon: '🌧️' },
  65: { condition: 'Heavy Rain', icon: '🌧️' },
  66: { condition: 'Freezing Rain', icon: '🌧️' },
  67: { condition: 'Freezing Rain', icon: '🌧️' },
  71: { condition: 'Light Snow', icon: '🌨️' },
  73: { condition: 'Snow', icon: '❄️' },
  75: { condition: 'Heavy Snow', icon: '❄️' },
  77: { condition: 'Snow Grains', icon: '🌨️' },
  80: { condition: 'Light Showers', icon: '🌦️' },
  81: { condition: 'Showers', icon: '🌧️' },
  82: { condition: 'Heavy Showers', icon: '🌧️' },
  85: { condition: 'Snow Showers', icon: '🌨️' },
  86: { condition: 'Heavy Snow Showers', icon: '❄️' },
  95: { condition: 'Thunderstorm', icon: '⛈️' },
  96: { condition: 'Thunderstorm + Hail', icon: '⛈️' },
  99: { condition: 'Thunderstorm + Hail', icon: '⛈️' },
}

// In-memory cache: key = "lat,lng,date", value = { data, fetchedAt }
const cache = new Map<string, { data: WeatherData; fetchedAt: number }>()
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

export async function getWeather(lat: number, lng: number, date: string): Promise<WeatherData | null> {
  // Only fetch for events within 7 days
  const eventDate = new Date(date + 'T00:00:00')
  const now = new Date()
  const daysUntil = Math.ceil((eventDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (daysUntil < 0 || daysUntil > 7) return null

  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)},${date}`
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data
  }

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weathercode&temperature_unit=fahrenheit&timezone=auto&start_date=${date}&end_date=${date}`
    )
    if (!res.ok) return null

    const json = await res.json()
    const daily = json.daily
    if (!daily?.temperature_2m_max?.[0]) return null

    const code = daily.weathercode?.[0] ?? 0
    const wmo = WMO_CONDITIONS[code] ?? { condition: 'Unknown', icon: '🌡️' }

    const data: WeatherData = {
      tempHigh: Math.round(daily.temperature_2m_max[0]),
      tempLow: Math.round(daily.temperature_2m_min[0]),
      condition: wmo.condition,
      icon: wmo.icon,
    }

    cache.set(cacheKey, { data, fetchedAt: Date.now() })
    return data
  } catch {
    return null
  }
}
