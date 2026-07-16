export type WeatherData = {
  temperature: number;
  windSpeed: number;
  weatherCode: number;
  humidity: number | null;
};

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "صافٍ",
  1: "غائم جزئيًا",
  2: "غائم جزئيًا",
  3: "غائم",
  45: "ضباب",
  48: "ضباب متجمد",
  51: "رذاذ خفيف",
  61: "أمطار خفيفة",
  63: "أمطار متوسطة",
  65: "أمطار غزيرة",
  71: "ثلوج خفيفة",
  80: "زخات مطرية",
  95: "عاصفة رعدية",
};

export function weatherDescription(code: number): string {
  return WEATHER_DESCRIPTIONS[code] ?? "غير معروف";
}

export async function getWeather(lat: number, lng: number): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      temperature: data.current?.temperature_2m ?? null,
      windSpeed: data.current?.wind_speed_10m ?? null,
      weatherCode: data.current?.weather_code ?? 0,
      humidity: data.current?.relative_humidity_2m ?? null,
    };
  } catch {
    return null;
  }
}
