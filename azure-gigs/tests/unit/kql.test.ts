import { describe, it, expect } from "vitest";
import { runKql, KqlError } from "@/lib/sim/kql";

const now = Date.parse("2026-01-01T12:00:00Z");
const tables = {
  Perf: [
    { TimeGenerated: new Date(now - 10 * 60000), Computer: "web1", CounterName: "% Processor Time", CounterValue: 50 },
    { TimeGenerated: new Date(now - 20 * 60000), Computer: "web1", CounterName: "% Processor Time", CounterValue: 70 },
    { TimeGenerated: new Date(now - 30 * 60000), Computer: "db1", CounterName: "% Processor Time", CounterValue: 10 },
    { TimeGenerated: new Date(now - 8 * 3600000), Computer: "db1", CounterName: "% Processor Time", CounterValue: 99 },
  ],
  Heartbeat: [
    { TimeGenerated: new Date(now - 60000), Computer: "web1" },
    { TimeGenerated: new Date(now - 3600000), Computer: "db1" },
  ],
};

describe("KQL interpreter", () => {
  it("filters with where and ago()", () => {
    expect(runKql("Perf | where TimeGenerated > ago(1h) | count", tables, now).rows).toEqual([{ Count: 3 }]);
  });
  it("summarizes with by and sorts", () => {
    const r = runKql("Perf | where TimeGenerated > ago(1h) | summarize Avg = avg(CounterValue) by Computer | sort by Avg desc", tables, now);
    expect(r.columns).toEqual(["Computer", "Avg"]);
    expect(r.rows).toEqual([{ Computer: "web1", Avg: 60 }, { Computer: "db1", Avg: 10 }]);
  });
  it("supports bin() time buckets and render", () => {
    const r = runKql("Perf | summarize count() by bin(TimeGenerated, 1h) | render timechart", tables, now);
    expect(r.chart).toBe("timechart");
    expect(r.rows.length).toBe(2);
  });
  it("supports project, extend, take, top, distinct, in, contains", () => {
    expect(runKql("Perf | extend Double = CounterValue * 2 | project Computer, Double | take 1", tables, now).rows[0]).toEqual({ Computer: "web1", Double: 100 });
    expect(runKql("Perf | top 1 by CounterValue desc | project CounterValue", tables, now).rows).toEqual([{ CounterValue: 99 }]);
    expect(runKql("Perf | distinct Computer", tables, now).rows.length).toBe(2);
    expect(runKql('Perf | where Computer in ("db1") | count', tables, now).rows[0].Count).toBe(2);
    expect(runKql('Perf | where Computer contains "WEB" | count', tables, now).rows[0].Count).toBe(2);
  });
  it("joins tables", () => {
    const r = runKql("Heartbeat | summarize Last = max(TimeGenerated) by Computer | join kind=inner (Perf | summarize Peak = max(CounterValue) by Computer) on Computer | project Computer, Peak", tables, now);
    expect(r.rows.sort((a, b) => String(a.Computer).localeCompare(String(b.Computer)))).toEqual([{ Computer: "db1", Peak: 99 }, { Computer: "web1", Peak: 70 }]);
  });
  it("gives helpful errors", () => {
    expect(() => runKql("perf | count", tables, now)).toThrow(/did you mean 'Perf'/);
    expect(() => runKql("Perf | where computer == 'x'", tables, now)).toThrow(/did you mean 'Computer'/);
    expect(() => runKql("Perf | explode", tables, now)).toThrow(KqlError);
    expect(() => runKql("Perf | where avg(CounterValue) > 1", tables, now)).toThrow(/only be used inside 'summarize'/);
  });
});
