/** EPA AQI categories by value: 1 Good (0-50) to 6 Hazardous (301+). */
export function aqiCategory(aqi: number): number {
  if (aqi <= 50) return 1;
  if (aqi <= 100) return 2;
  if (aqi <= 150) return 3;
  if (aqi <= 200) return 4;
  if (aqi <= 300) return 5;
  return 6;
}

/** One row of AirNow's /aq/observation/current/ziplatlong/ response (the format since Oct 1, 2026). */
export type AirNowRow = {
  dateObserved: string;
  hourObserved: string;
  localTimeZone?: string;
  reportingAreaName: string;
  siteName?: string;
  parameterName: string;
  nowcastAQI: number;
  aqiCategoryName: string;
};

export type AirQuality = { aqi: number; category: number; categoryName: string; pollutant: string; area: string; observedAt: string };

/** The AQI for an area is its worst pollutant. Returns null when there is no usable reading. */
export function summarizeAirNow(rows: unknown): AirQuality | null {
  if (!Array.isArray(rows)) return null;
  const valid = (rows as AirNowRow[]).filter((r) => typeof r?.nowcastAQI === 'number' && r.nowcastAQI >= 0);
  if (!valid.length) return null;
  const worst = valid.reduce((a, b) => (b.nowcastAQI > a.nowcastAQI ? b : a));
  return {
    aqi: worst.nowcastAQI,
    category: aqiCategory(worst.nowcastAQI),
    categoryName: worst.aqiCategoryName,
    pollutant: worst.parameterName,
    area: worst.reportingAreaName,
    observedAt: `${worst.dateObserved} ${worst.hourObserved}${worst.localTimeZone ? ' ' + worst.localTimeZone : ''}`,
  };
}
