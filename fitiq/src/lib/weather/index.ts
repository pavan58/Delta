import type { WeatherContext } from "../types";

/**
 * Weather is only used when a provider returns CURRENT data (or the user states
 * conditions). With no WEATHER_API_KEY, FITIQ makes no weather claims.
 */
export async function currentWeather(city: string): Promise<WeatherContext | null> {
  const key = process.env.WEATHER_API_KEY;
  if (!key || !city) return null;
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&units=metric&appid=${key}`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const j = (await res.json()) as { main?: { temp?: number; humidity?: number }; weather?: { main?: string }[]; dt?: number };
    const t = j.main?.temp;
    const main = (j.weather?.[0]?.main ?? "").toLowerCase();
    let condition: WeatherContext["condition"] = "mild";
    if (/rain|drizzle|thunder/.test(main)) condition = "rain";
    else if (t !== undefined && t >= 32) condition = "hot";
    else if (t !== undefined && t >= 27 && (j.main?.humidity ?? 0) > 70) condition = "humid";
    else if (t !== undefined && t < 12) condition = "cold";
    else if (t !== undefined && t < 20) condition = "cool";
    return { condition, tempC: t, source: "provider", providerName: "OpenWeatherMap", observedAt: j.dt ? new Date(j.dt * 1000).toISOString() : new Date().toISOString(), city };
  } catch {
    return null;
  }
}
