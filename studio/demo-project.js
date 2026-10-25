


(function (root) {
  "use strict";

  function seeded(seed) {
    let state = seed >>> 0;
    return () => { state = (state + 0x6D2B79F5) >>> 0; let t = state; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function months(fromYear, fromMonth, count) {
    const list = [];
    let year = fromYear, month = fromMonth;
    for (let i = 0; i < count; i++) { list.push(`${year}-${String(month).padStart(2, "0")}`); month += 1; if (month > 12) { month = 1; year += 1; } }
    return list;
  }

  function build() {
    const random = seeded(20260822);
    const periods = months(2025, 1, 20);
    const regions = { North: 1.0, South: .86, East: 1.12, West: 1.05 };
    const products = { Starter: { price: 49, mix: 3.2 }, Pro: { price: 149, mix: 1.6 }, Enterprise: { price: 499, mix: .42 } };
    const channels = { Online: 1, Partner: .55 };
    const sales = [];
    periods.forEach((period, index) => {
      const month = Number(period.slice(5));
      const season = 1 + .07 * Math.sin((month - 3) / 12 * Math.PI * 2);
      const growth = 1 + .012 * index;
      Object.entries(regions).forEach(([region, regionWeight]) => Object.entries(products).forEach(([product, spec]) => Object.entries(channels).forEach(([channel, channelWeight]) => {
        let units = 40 * regionWeight * spec.mix * channelWeight * season * growth * (0.94 + random() * .12);
        const lastMonth = index === periods.length - 1;
        if (lastMonth && region === "West") units *= product === "Enterprise" ? .58 : .95;
        units = Math.max(1, Math.round(units));
        const discount = Math.round(random() * 9 + (channel === "Partner" ? 4 : 0));
        const revenue = Math.round(units * spec.price * (1 - discount / 100) * 100) / 100;
        const satisfaction = random() < .03 ? "" : (3.6 + random() * 1.2 - (lastMonth && region === "West" ? .35 : 0)).toFixed(1);
        sales.push({ order_month: `${period}-01`, region, product, channel, units, revenue, discount_pct: discount, satisfaction });
      })));
    });

    sales[5].region = " West"; sales[29].region = " West";
    sales[53].region = "west"; sales[77].region = "west"; sales[101].region = "west";
    [8, 30, 64, 90].forEach(index => sales.push({ ...sales[index] }));

    const targets = [];
    periods.forEach(period => Object.keys(regions).forEach(region => {
      const actual = sales.filter(row => row.order_month.startsWith(period) && row.region === region).reduce((total, row) => total + row.revenue, 0);
      targets.push({ region, month: period, revenue_target: Math.round(actual * (1.02 + random() * .06) / 100) * 100 });
    }));

    const regionInfo = [
      { region: "North", manager: "Sample Manager A", territory: "Great Lakes" },
      { region: "South", manager: "Sample Manager B", territory: "Gulf Coast" },
      { region: "East", manager: "Sample Manager C", territory: "Atlantic" },
      { region: "West", manager: "Sample Manager D", territory: "Pacific" }
    ];

    const dataset = (name, rows) => ({ id: `demo_${name.replace(/\W+/g, "_")}`, name, columns: Object.keys(rows[0]), rows, originalRowCount: rows.length, source: "demo", addedAt: Date.UTC(2026, 8, 1) });
    return {
      name: "Demo · Northwind Retail",
      goal: "Understand why sales dropped last month and decide what to do about it.",
      datasets: [dataset("sales_2025_2026.csv", sales), dataset("revenue_targets.csv", targets), dataset("regions.csv", regionInfo)],
      starterPrompt: "Why did sales drop last month? Show me what drove it."
    };
  }

  const api = { build };
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) { root.SignalNoir = root.SignalNoir || {}; root.SignalNoir.demo = api; }
})(typeof window !== "undefined" ? window : null);
