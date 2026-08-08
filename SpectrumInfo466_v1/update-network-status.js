const puppeteer = require("puppeteer");
const fs = require("fs/promises");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const randomDelay = (minMs, maxMs) => (
  Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
);

const operators = {
  cht: {
    name: "中華電信",
    url: "https://downdetector.tw/status/chunghwa-telecom-zhong-hua-dian-xin/",
  },
  fet: {
    name: "遠傳電信",
    url: "https://downdetector.tw/status/far-eastone-telecommunications-fet-yuan-chuan-dian-xin/",
  },
  twm: {
    name: "台灣大哥大",
    url: "https://downdetector.tw/status/taiwan-mobile-tai-wan-da-ge-da/",
  },
};

function parseNormalText(text) {
  return (
    text.includes("運作正常") ||
    text.includes("no current problems") ||
    text.includes("User reports show no current problems")
  );
}

function isBlockedPage(text) {
  return (
    text.includes("Performing security verification") ||
    text.includes("This website uses a security service") ||
    text.includes("Cloudflare") ||
    text.includes("Just a moment") ||
    text.includes("Enable JavaScript and cookies")
  );
}

function normalizeTimestamp(value) {
  if (typeof value === "string" && !/^\d+$/.test(value)) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return null;
  return timestamp < 1000000000000 ? timestamp * 1000 : timestamp;
}

function addPoint(points, timestampValue, countValue) {
  const timestamp = normalizeTimestamp(timestampValue);
  const count = Number(countValue);

  if (!Number.isFinite(timestamp) || !Number.isFinite(count)) return;
  points.push({ timestamp, count });
}

function extractReportPointsFromText(source) {
  const points = [];
  const numericPairPattern = /\[\s*(\d{10,13})\s*,\s*(\d{1,6})\s*\]/g;
  const stringPairPattern = /\[\s*["']([^"']+)["']\s*,\s*(\d{1,6})\s*\]/g;
  const objectXYPattern = /["']?(?:x|date|time|timestamp)["']?\s*:\s*(\d{10,13})\s*,\s*["']?(?:y|value|count|reports)["']?\s*:\s*(\d{1,6})/g;
  const objectYXPattern = /["']?(?:y|value|count|reports)["']?\s*:\s*(\d{1,6})\s*,\s*["']?(?:x|date|time|timestamp)["']?\s*:\s*(\d{10,13})/g;
  const objectStringXYPattern = /["']?(?:x|date|time|timestamp)["']?\s*:\s*["']([^"']+)["']\s*,\s*["']?(?:y|value|count|reports)["']?\s*:\s*(\d{1,6})/g;
  const objectStringYXPattern = /["']?(?:y|value|count|reports)["']?\s*:\s*(\d{1,6})\s*,\s*["']?(?:x|date|time|timestamp)["']?\s*:\s*["']([^"']+)["']/g;
  let match;

  while ((match = numericPairPattern.exec(source))) {
    addPoint(points, match[1], match[2]);
  }

  while ((match = stringPairPattern.exec(source))) {
    addPoint(points, match[1], match[2]);
  }

  while ((match = objectXYPattern.exec(source))) {
    addPoint(points, match[1], match[2]);
  }

  while ((match = objectYXPattern.exec(source))) {
    addPoint(points, match[2], match[1]);
  }

  while ((match = objectStringXYPattern.exec(source))) {
    addPoint(points, match[1], match[2]);
  }

  while ((match = objectStringYXPattern.exec(source))) {
    addPoint(points, match[2], match[1]);
  }

  return points;
}

function extractReportPointsFromJson(value, points = []) {
  if (Array.isArray(value)) {
    if (value.length >= 2) {
      addPoint(points, value[0], value[1]);
    }
    value.forEach((item) => extractReportPointsFromJson(item, points));
    return points;
  }

  if (!value || typeof value !== "object") return points;

  const timestamp = value.x ?? value.date ?? value.time ?? value.timestamp;
  const count = value.y ?? value.value ?? value.count ?? value.reports;
  if (timestamp !== undefined && count !== undefined) {
    addPoint(points, timestamp, count);
  }

  Object.values(value).forEach((item) => extractReportPointsFromJson(item, points));
  return points;
}

function extractReportPointsFromSources(sources) {
  const now = Date.now();
  const points = [];

  sources.forEach((source) => {
    if (!source) return;
    points.push(...extractReportPointsFromText(source));

    try {
      points.push(...extractReportPointsFromJson(JSON.parse(source)));
    } catch {
      // Not JSON; regex extraction above already handled text/HTML/script payloads.
    }
  });

  const deduped = new Map();
  points
    .filter((point) =>
      Number.isFinite(point.timestamp) &&
      Number.isFinite(point.count) &&
      point.timestamp > now - 25 * 60 * 60 * 1000 &&
      point.timestamp < now + 10 * 60 * 1000
    )
    .forEach((point) => {
      deduped.set(`${point.timestamp}:${point.count}`, point);
    });

  return [...deduped.values()].sort((a, b) => a.timestamp - b.timestamp);
}

function parseLatestReportPoint(sources) {
  const points = extractReportPointsFromSources(sources);
  const latestPoint = points[points.length - 1];

  if (!latestPoint) {
    const peakReports = parseChartPeakReports(sources);
    return {
      reports: peakReports,
      latestPointTime: null,
      reportCountSource: peakReports > 0 ? "chartPeak" : "none",
      reportPointCount: 0,
    };
  }

  return {
    reports: latestPoint.count,
    latestPointTime: new Date(latestPoint.timestamp).toISOString(),
    reportCountSource: "latestPoint",
    reportPointCount: points.length,
  };
}

function parseChartPeakReports(sources) {
  for (const source of sources) {
    const match = source.match(/Reports chart for the last 24 hours with a peak of\s+([\d,]+)\s+reports?/i);
    if (match) {
      return Number(match[1].replace(/,/g, "")) || 0;
    }
  }

  return 0;
}

function findSnippet(source, pattern) {
  const match = pattern.exec(source);
  if (!match) return "";

  const start = Math.max(0, match.index - 180);
  const end = Math.min(source.length, match.index + 420);
  return source.slice(start, end).replace(/\s+/g, " ").trim();
}

function buildResponseSnippets(responseBodies, responseDebug) {
  return responseBodies
    .map((body, index) => {
      const debug = responseDebug[index] || {};
      const snippet =
        findSnippet(body, /problems reported in the last 24 hours/i) ||
        findSnippet(body, /Most reported problems/i) ||
        findSnippet(body, /series|reports|problem|outage|chart/i) ||
        findSnippet(body, /\d{10,13}/);

      if (!snippet) return null;

      return {
        url: debug.url || "",
        contentType: debug.contentType || "",
        length: body.length,
        snippet,
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const aIsPage = /downdetector\.tw\/(?:en\/)?status\//i.test(a.url) ? 0 : 1;
      const bIsPage = /downdetector\.tw\/(?:en\/)?status\//i.test(b.url) ? 0 : 1;
      return aIsPage - bIsPage;
    })
    .slice(0, 8);
}

function parseTopProblem(text) {
  const section = text.split(/Most reported problems|最多回報/i)[1]?.split(/Your feedback|How would you rate|您的意見|你會如何評價/i)[0] || "";
  const match = section.match(/(\d{1,3})%\s+(.+?)(?=\s+\d{1,3}%|$)/);
  if (!match) return { label: "", share: 0 };

  return {
    share: Number(match[1]),
    label: match[2].trim().replace(/\s{2,}/g, " "),
  };
}

function decideLevel({ normalTextFound, reports, reportCountSource, topProblem }) {
  const broadbandOnly =
    /Broadband Internet|寬頻網路/i.test(topProblem.label) &&
    topProblem.share > 30;
  const canUseReportThresholds =
    reportCountSource === "latestPoint" ||
    (reportCountSource === "chartPeak" && !normalTextFound);

  if (broadbandOnly) return "green";
  if (canUseReportThresholds && reports > 100) return "red";
  if (canUseReportThresholds && reports > 10) return "yellow";
  if (normalTextFound) return "green";
  return "green";
}

async function scrapeOperator(browser, key, operator) {
  const page = await browser.newPage();
  const responseBodies = [];
  const responseReads = [];
  const responseDebug = [];

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );
  await page.setExtraHTTPHeaders({
    "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
  });
  await page.setViewport({
    width: 1366 + Math.floor(Math.random() * 120),
    height: 768 + Math.floor(Math.random() * 120),
    deviceScaleFactor: 1,
  });

  page.on("response", (response) => {
    const readResponse = async () => {
      const headers = response.headers();
      const contentType = headers["content-type"] || "";
      const responseUrl = response.url();
      if (/text\/css/i.test(contentType)) return;
      if (/doubleclick|googlesyndication|ziffstatic|google-analytics|googletagmanager/i.test(responseUrl)) return;

      const shouldRead =
        /json|javascript|html/i.test(contentType) ||
        /downdetector|status|report|problem|chart|graph|api|_next/i.test(responseUrl);

      if (!shouldRead) return;

      try {
        const body = await response.text();
        if (body) {
          responseBodies.push(body);
          const bodyIndex = responseBodies.length - 1;
          responseDebug[bodyIndex] = {
            url: responseUrl,
            contentType,
            length: body.length,
            hasTimestamp: /\d{10,13}/.test(body),
            hasReportKeyword: /report|problem|chart|graph|series|outage/i.test(body),
          };
        }
      } catch {
        // Some responses cannot be read by Puppeteer; ignore and continue.
      }
    };

    responseReads.push(readResponse());
  });

  try {
    await page.goto(operator.url, {
      waitUntil: "networkidle2",
      timeout: 60000,
    });

    await sleep(1500);
    await Promise.allSettled(responseReads);

    const { text, html } = await page.evaluate(() => ({
      text: document.body.innerText,
      html: document.documentElement.outerHTML,
    }));

    if (isBlockedPage(text)) {
      return {
        name: operator.name,
        reachable: false,
        blocked: true,
        normalTextFound: false,
        reports: null,
        latestPointTime: null,
        reportCountSource: "none",
        reportPointCount: 0,
        topProblem: { label: "", share: 0 },
        level: "green",
        message: "",
        error: "Blocked by Cloudflare verification",
        sample: text.slice(0, 600),
      };
    }

    const normalTextFound = parseNormalText(text);
    const reportPoint = parseLatestReportPoint([html, ...responseBodies]);
    const topProblem = parseTopProblem(text);
    const level = decideLevel({
      normalTextFound,
      reports: reportPoint.reports,
      reportCountSource: reportPoint.reportCountSource,
      topProblem,
    });

    return {
      name: operator.name,
      reachable: true,
      normalTextFound,
      reports: reportPoint.reports,
      latestPointTime: reportPoint.latestPointTime,
      reportCountSource: reportPoint.reportCountSource,
      reportPointCount: reportPoint.reportPointCount,
      responseSourceCount: responseBodies.length,
      responseDebug: reportPoint.reportPointCount === 0
        ? responseDebug
          .filter((item) => item.hasTimestamp || item.hasReportKeyword)
          .slice(0, 12)
        : [],
      responseSnippets: reportPoint.reportPointCount === 0
        ? buildResponseSnippets(responseBodies, responseDebug)
        : [],
      topProblem,
      level,
      message: text.split("\n").find((line) =>
        line.includes("no current problems") || line.includes("運作正常")
      ) || "",
      sample: text.slice(0, 600),
    };
  } finally {
    await page.close();
  }
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--lang=zh-TW,zh",
    ],
  });

  const result = {
    updated: new Date().toISOString(),
  };

  for (const [key, operator] of Object.entries(operators)) {
    try {
      result[key] = await scrapeOperator(browser, key, operator);
    } catch (error) {
      result[key] = {
        name: operator.name,
        reachable: false,
        normalTextFound: false,
        reports: null,
        latestPointTime: null,
        reportCountSource: "none",
        reportPointCount: 0,
        topProblem: { label: "", share: 0 },
        level: "green",
        message: "",
        error: error.message,
      };
    }

    await sleep(randomDelay(3500, 8500));
  }

  await browser.close();

  await fs.writeFile(
    "network-status.json",
    JSON.stringify(result, null, 2),
    "utf8"
  );

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
