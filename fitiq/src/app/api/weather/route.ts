import { NextResponse } from "next/server";
import { currentWeather } from "@/lib/weather";

export async function GET(req: Request) {
  const city = new URL(req.url).searchParams.get("city") ?? "";
  const w = await currentWeather(city.slice(0, 60));
  return NextResponse.json({ weather: w, available: Boolean(process.env.WEATHER_API_KEY) });
}
