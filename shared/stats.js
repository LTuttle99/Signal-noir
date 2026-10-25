function statsIsBlank(v) {
  return v === null || v === undefined || String(v).trim() === "";
}

function statsToNumber(v) {
  if (statsIsBlank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function statsMean(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function statsMedian(sorted) {
  if (!sorted || sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function statsStdDev(arr, m) {
  if (!arr || arr.length < 2) return 0;
  const avg = m === undefined ? statsMean(arr) : m;
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function statsPercentile(sorted, p) {
  if (!sorted || sorted.length === 0) return null;
  if (sorted.length === 1) return sorted[0];

  const pos = (sorted.length - 1) * p;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (pos - lower);
}

function statsLogGamma(x) {
  const coefficients = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);

  let series = 1.000000000190015;
  for (let j = 0; j < 6; j++) series += coefficients[j] / ++y;

  return -tmp + Math.log((2.5066282746310005 * series) / x);
}

function statsBetaContinuedFraction(x, a, b) {
  const tiny = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;

    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;

    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < 3e-16) break;
  }

  return h;
}

function statsIncompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  const front = Math.exp(
    statsLogGamma(a + b) - statsLogGamma(a) - statsLogGamma(b) + a * Math.log(x) + b * Math.log(1 - x)
  );

  if (x < (a + 1) / (a + b + 2)) return (front * statsBetaContinuedFraction(x, a, b)) / a;
  return 1 - (Math.exp(
    statsLogGamma(a + b) - statsLogGamma(a) - statsLogGamma(b) + b * Math.log(1 - x) + a * Math.log(x)
  ) * statsBetaContinuedFraction(1 - x, b, a)) / b;
}

function statsFDistributionP(f, df1, df2) {
  if (!Number.isFinite(f) || f <= 0 || df1 <= 0 || df2 <= 0) return 1;
  return statsIncompleteBeta(df2 / (df2 + df1 * f), df2 / 2, df1 / 2);
}

function statsLowerGamma(a, x) {
  if (x <= 0) return 0;

  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 500; n++) {
      ap++;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - statsLogGamma(a));
  }

  const tiny = 1e-30;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i <= 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }

  return 1 - Math.exp(-x + a * Math.log(x) - statsLogGamma(a)) * h;
}

function statsErf(x) {
  if (x === 0) return 0;
  const value = statsLowerGamma(0.5, x * x);
  return x > 0 ? value : -value;
}

function statsNormalCdf(z) {
  return 0.5 * (1 + statsErf(z / Math.SQRT2));
}

function statsChiSquareP(x, df) {
  if (!Number.isFinite(x) || x <= 0 || df <= 0) return 1;
  return 1 - statsLowerGamma(df / 2, x / 2);
}

function statsTDistributionP(t, df) {
  if (!Number.isFinite(t) || df <= 0) return 1;
  const abs = Math.abs(t);
  return statsIncompleteBeta(df / (df + abs * abs), df / 2, 0.5);
}

function statsCleanPairs(xs, ys) {
  const out = [];
  const limit = Math.min(xs.length, ys.length);
  for (let i = 0; i < limit; i++) {
    if (Number.isFinite(xs[i]) && Number.isFinite(ys[i])) out.push([xs[i], ys[i]]);
  }
  return out;
}

function statsTTest(a, b, options) {
  const settings = options || {};
  const paired = !!settings.paired;
  const pooled = !!settings.pooled;

  if (paired) {
    const pairs = statsCleanPairs(a || [], b || []);
    if (pairs.length < 2) return { ok: false, reason: "Need at least two complete pairs." };

    const diffs = pairs.map((p) => p[0] - p[1]);
    const n = diffs.length;
    const m = statsMean(diffs);
    const sd = Math.sqrt(diffs.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1));

    if (sd === 0) return { ok: false, reason: "Every pair differs by exactly the same amount, so there is no variation to test." };

    const t = m / (sd / Math.sqrt(n));
    const df = n - 1;
    return { ok: true, kind: "paired", t: t, df: df, p: statsTDistributionP(t, df), n: n, meanDifference: m, sd: sd };
  }

  const x = (a || []).filter((v) => Number.isFinite(v));
  const y = (b || []).filter((v) => Number.isFinite(v));

  if (x.length < 2 || y.length < 2) return { ok: false, reason: "Need at least two values in each group." };

  const n1 = x.length;
  const n2 = y.length;
  const m1 = statsMean(x);
  const m2 = statsMean(y);
  const v1 = x.reduce((s, v) => s + (v - m1) ** 2, 0) / (n1 - 1);
  const v2 = y.reduce((s, v) => s + (v - m2) ** 2, 0) / (n2 - 1);

  if (v1 === 0 && v2 === 0) return { ok: false, reason: "Neither group varies at all, so there is nothing to test against." };

  let t;
  let df;

  if (pooled) {
    const sp2 = ((n1 - 1) * v1 + (n2 - 1) * v2) / (n1 + n2 - 2);
    t = (m1 - m2) / Math.sqrt(sp2 * (1 / n1 + 1 / n2));
    df = n1 + n2 - 2;
  } else {
    const se2 = v1 / n1 + v2 / n2;
    t = (m1 - m2) / Math.sqrt(se2);
    df = (se2 * se2) / ((v1 / n1) ** 2 / (n1 - 1) + (v2 / n2) ** 2 / (n2 - 1));
  }

  return {
    ok: true,
    kind: pooled ? "student" : "welch",
    t: t,
    df: df,
    p: statsTDistributionP(t, df),
    groups: [
      { n: n1, mean: m1, sd: Math.sqrt(v1) },
      { n: n2, mean: m2, sd: Math.sqrt(v2) }
    ],
    meanDifference: m1 - m2
  };
}

function statsChiSquareIndependence(table) {
  const rows = (table || []).filter((row) => Array.isArray(row) && row.length > 0);
  if (rows.length < 2) return { ok: false, reason: "Need at least two rows to compare." };

  const width = rows[0].length;
  if (width < 2 || rows.some((row) => row.length !== width)) {
    return { ok: false, reason: "Need at least two columns, and every row must be the same width." };
  }

  const rowTotals = rows.map((row) => row.reduce((s, v) => s + v, 0));
  const colTotals = [];
  for (let c = 0; c < width; c++) colTotals.push(rows.reduce((s, row) => s + row[c], 0));

  const total = rowTotals.reduce((s, v) => s + v, 0);
  if (total === 0) return { ok: false, reason: "The table is empty." };
  if (rowTotals.some((v) => v === 0) || colTotals.some((v) => v === 0)) {
    return { ok: false, reason: "Every row and column needs at least one observation." };
  }

  let chi = 0;
  let smallest = Infinity;

  for (let r = 0; r < rows.length; r++) {
    for (let c = 0; c < width; c++) {
      const expected = (rowTotals[r] * colTotals[c]) / total;
      if (expected < smallest) smallest = expected;
      chi += (rows[r][c] - expected) ** 2 / expected;
    }
  }

  const df = (rows.length - 1) * (width - 1);
  const n = total;
  const minDim = Math.min(rows.length, width) - 1;

  return {
    ok: true,
    chiSquare: chi,
    df: df,
    p: statsChiSquareP(chi, df),
    total: n,
    smallestExpected: smallest,
    cramersV: minDim === 0 ? 0 : Math.sqrt(chi / (n * minDim))
  };
}

function statsRank(values) {
  const indexed = values.map((v, i) => ({ v: v, i: i }));
  indexed.sort((a, b) => a.v - b.v);

  const ranks = new Array(values.length);
  let start = 0;

  while (start < indexed.length) {
    let end = start;
    while (end + 1 < indexed.length && indexed[end + 1].v === indexed[start].v) end++;
    const rank = (start + end) / 2 + 1;
    for (let k = start; k <= end; k++) ranks[indexed[k].i] = rank;
    start = end + 1;
  }

  return ranks;
}

function statsPearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return null;

  const mx = statsMean(xs);
  const my = statsMean(ys);

  let num = 0;
  let dx = 0;
  let dy = 0;

  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }

  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

function statsCorrelation(xsRaw, ysRaw) {
  const pairs = statsCleanPairs(xsRaw || [], ysRaw || []);
  if (pairs.length < 3) return { ok: false, reason: "Need at least three complete pairs of numbers." };

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);

  const r = statsPearson(xs, ys);
  if (r === null) return { ok: false, reason: "One of the columns never changes, so it cannot correlate with anything." };

  const n = pairs.length;
  const df = n - 2;
  const clamped = Math.min(Math.max(r, -0.9999999999), 0.9999999999);
  const t = clamped * Math.sqrt(df / (1 - clamped * clamped));

  const rho = statsPearson(statsRank(xs), statsRank(ys));
  const rhoT = rho === null ? null : Math.min(Math.max(rho, -0.9999999999), 0.9999999999) * Math.sqrt(df / (1 - Math.min(Math.max(rho, -0.9999999999), 0.9999999999) ** 2));

  return {
    ok: true,
    n: n,
    r: r,
    rSquared: r * r,
    p: statsTDistributionP(t, df),
    spearman: rho,
    spearmanP: rhoT === null ? null : statsTDistributionP(rhoT, df),
    df: df
  };
}

function statsLinearFit(xsRaw, ysRaw) {
  const pairs = statsCleanPairs(xsRaw || [], ysRaw || []);
  if (pairs.length < 3) return { ok: false, reason: "Need at least three complete pairs of numbers." };

  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const n = pairs.length;

  const mx = statsMean(xs);
  const my = statsMean(ys);

  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
  }

  if (sxx === 0) return { ok: false, reason: "The predictor never changes, so no line can be fitted through it." };

  const slope = sxy / sxx;
  const intercept = my - slope * mx;

  let ssTotal = 0;
  let ssResidual = 0;
  for (let i = 0; i < n; i++) {
    const predicted = intercept + slope * xs[i];
    ssTotal += (ys[i] - my) ** 2;
    ssResidual += (ys[i] - predicted) ** 2;
  }

  const df = n - 2;
  const rSquared = ssTotal === 0 ? 1 : 1 - ssResidual / ssTotal;
  const residualVariance = df === 0 ? 0 : ssResidual / df;
  const slopeError = sxx === 0 ? 0 : Math.sqrt(residualVariance / sxx);
  const t = slopeError === 0 ? Infinity : slope / slopeError;

  return {
    ok: true,
    n: n,
    slope: slope,
    intercept: intercept,
    rSquared: rSquared,
    slopeError: slopeError,
    t: t,
    df: df,
    p: Number.isFinite(t) ? statsTDistributionP(t, df) : 0
  };
}

function statsAnova(groups) {
  const clean = (groups || [])
    .map((group) => ({ label: group.label, values: (group.values || []).filter((v) => Number.isFinite(v)) }))
    .filter((group) => group.values.length >= 2);

  if (clean.length < 2) {
    return { ok: false, reason: "Need at least two groups with two or more numeric values each." };
  }

  const total = clean.reduce((sum, group) => sum + group.values.length, 0);
  const dfBetween = clean.length - 1;
  const dfWithin = total - clean.length;

  if (dfWithin <= 0) {
    return { ok: false, reason: "Need more rows than groups to measure variation inside the groups." };
  }

  const grandMean = statsMean(clean.reduce((all, group) => all.concat(group.values), []));

  let ssBetween = 0;
  let ssWithin = 0;

  const summary = clean.map((group) => {
    const mean = statsMean(group.values);
    ssBetween += group.values.length * (mean - grandMean) ** 2;
    for (const value of group.values) ssWithin += (value - mean) ** 2;
    return { label: group.label, n: group.values.length, mean: mean, sd: statsStdDev(group.values, mean) };
  });

  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  if (msWithin === 0) {
    return {
      ok: false,
      reason: "Every value inside each group is identical, so there is no variation to test against.",
      groups: summary
    };
  }

  const f = msBetween / msWithin;
  const p = statsFDistributionP(f, dfBetween, dfWithin);
  const etaSquared = ssBetween + ssWithin === 0 ? 0 : ssBetween / (ssBetween + ssWithin);

  return {
    ok: true,
    f: f,
    p: p,
    dfBetween: dfBetween,
    dfWithin: dfWithin,
    grandMean: grandMean,
    msBetween: msBetween,
    msWithin: msWithin,
    etaSquared: etaSquared,
    groups: summary
  };
}

function statsHistogram(sorted, buckets = 12) {
  if (!sorted || sorted.length === 0) return [];

  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  if (min === max) return [sorted.length];

  const counts = new Array(buckets).fill(0);
  const width = (max - min) / buckets;

  for (const v of sorted) {
    let idx = Math.floor((v - min) / width);
    if (idx >= buckets) idx = buckets - 1;
    if (idx < 0) idx = 0;
    counts[idx]++;
  }

  return counts;
}
