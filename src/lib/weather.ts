import { today } from './utils';
import { seedWeather } from './seed';

export const fetchRealWeather = async (owmKey: string, lat = 39.9626, lon = -76.7277) => {
  if (!owmKey) return null;
  try {
    const [cur, fore] = await Promise.all([
      fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=imperial&appid=${owmKey}`).then(r => r.json()),
      fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=imperial&cnt=5&appid=${owmKey}`).then(r => r.json())
    ]);
    if (cur.cod !== 200) return null;
    const current = {
      temp: Math.round(cur.main.temp),
      condition: cur.weather[0].main.toLowerCase().replace(" ", "_"),
      rainChance: Math.round((cur.pop || 0) * 100),
      wind: Math.round(cur.wind.speed),
      humidity: cur.main.humidity,
      description: cur.weather[0].description
    };
    const forecast = (fore.list || []).slice(0, 5).map((f: any) => ({
      day: new Date(f.dt * 1000).toLocaleDateString("en-US", { weekday: "short" }),
      temp: Math.round(f.main.temp),
      lowTemp: Math.round(f.main.temp_min),
      rainChance: Math.round((f.pop || 0) * 100),
      wind: Math.round(f.wind.speed),
      condition: f.weather[0].main
    }));
    return { current, forecast };
  } catch { return null; }
};

export const forecastFor = (dateStr: string, weatherOverride?: any) => {
  if (!dateStr) return null;
  const diff = Math.round((new Date(dateStr).getTime() - new Date(today()).getTime()) / 86400000);
  if (diff < 0 || diff > 6) return null;
  if (diff === 0) return null;
  const src = weatherOverride || seedWeather;
  return (src.forecast || [])[diff - 1] || null;
};

export const weatherRisk = (dateStr: string) => {
  const f = forecastFor(dateStr);
  if (!f) return null;
  if (f.rainChance >= 70) return { level: "high", reason: f.rainChance + "% rain", icon: "🌧️" };
  if (f.rainChance >= 40) return { level: "med", reason: f.rainChance + "% rain", icon: "🌦️" };
  if (f.wind >= 15) return { level: "med", reason: f.wind + "mph wind", icon: "💨" };
  if (f.temp >= 88) return { level: "med", reason: f.temp + "°F", icon: "🥵" };
  if ((f.lowTemp || f.temp) < 35) return { level: "high", reason: "Freezing risk", icon: "🥶" };
  return null;
};
