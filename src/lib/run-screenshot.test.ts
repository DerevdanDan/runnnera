import { describe, expect, it } from "vitest";
import { parseRunScreenshot } from "./run-screenshot";

const now = new Date(2026, 9, 26, 12, 0); // 26 Oct 2026, local time

describe("reading run screenshots", () => {
  it("reads a Strava activity (labels above values)", () => {
    const text = `Morning Run
October 24, 2026 at 7:32 AM · Madrid
Distance Pace Time
10.02 km 5:12 /km 52:10
Elevation Gain Calories Avg Heart Rate
45 m 650 Cal 152 bpm`;
    expect(parseRunScreenshot(text, now)).toEqual({ km: 10.02, seconds: 52 * 60 + 10, date: "2026-10-24" });
  });

  it("reads a Spanish Strava share with comma decimals", () => {
    const text = `Carrera de mañana
Distancia
8,5 km
Ritmo
5:30 /km
Tiempo
46m 45s
24 de octubre de 2026`;
    expect(parseRunScreenshot(text, now)).toEqual({ km: 8.5, seconds: 46 * 60 + 45, date: "2026-10-24" });
  });

  it("reads a Garmin Connect summary (labels below values)", () => {
    const text = `Running
Oct 24, 2026 @ 7:30 AM
10.02
km
Distance
1:02:15
Time
6:13
Avg Pace
/km`;
    expect(parseRunScreenshot(text, now)).toEqual({ km: 10.02, seconds: 3600 + 2 * 60 + 15, date: "2026-10-24" });
  });

  it("prefers moving time over elapsed time", () => {
    const text = `Distance 12.4 km
Elapsed Time 1:08:30
Moving Time 1:04:12`;
    expect(parseRunScreenshot(text, now).seconds).toBe(3600 + 4 * 60 + 12);
  });

  it("understands yesterday and ignores the clock time", () => {
    const text = `Yesterday at 18:05
5.0 km
27:30`;
    expect(parseRunScreenshot(text, now)).toEqual({ km: 5, seconds: 27 * 60 + 30, date: "2026-10-25" });
  });

  it("converts miles", () => {
    expect(parseRunScreenshot("3.11 mi\nTime 28:00", now).km).toBe(5.01);
  });

  it("doesn't read elevation metres or speed as time or distance", () => {
    expect(parseRunScreenshot("Distance 5.2 km\nElevation 45 m\nSpeed 11.5 km/h", now)).toEqual({
      km: 5.2,
      seconds: null,
      date: null,
    });
  });

  it("fixes an O read instead of a zero", () => {
    expect(parseRunScreenshot("1O.02 km", now).km).toBe(10.02);
  });

  it("puts a date without a year in the past", () => {
    const january = new Date(2026, 0, 5, 12, 0);
    expect(parseRunScreenshot("Dec 30\n6.0 km", january).date).toBe("2025-12-30");
  });

  it("returns nothing for unrelated text", () => {
    expect(parseRunScreenshot("hello world", now)).toEqual({ km: null, seconds: null, date: null });
  });
});
