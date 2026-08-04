const puppeteer = require("puppeteer");
const fs = require("fs/promises");

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

function parseReportCount(text) {
  const match = text.match(/problems reported in the last 24 hours[\s\S]*?\n([\d,]+)\n/i);
  if (!match) return 0;
  return Number(match[1].replace(/,/g, "")) || 0;
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

function decideLevel({ normalTextFound, reports, topProblem }) {
  const broadbandOnly =
    /Broadband Internet|寬頻網路/i.test(topProblem.label) &&
    topProblem.share > 30;

  if (broadbandOnly) return "green";
  if (normalTextFound) return "green";
  if (reports > 100) return "red";
  if (reports > 10) return "yellow";
  return "green";
}

async function scrapeOperator(page, key, operator) {
  await page.goto(operator.url, {
    waitUntil: "networkidle2",
    timeout: 60000,
  });

  const text = await page.evaluate(() => document.body.innerText);

  const normalTextFound = parseNormalText(text);
  const reports = parseReportCount(text);
  const topProblem = parseTopProblem(text);
  const level = decideLevel({ normalTextFound, reports, topProblem });

  return {
    name: operator.name,
    reachable: true,
    normalTextFound,
    reports,
    topProblem,
    level,
    message: text.split("\n").find((line) =>
      line.includes("no current problems") || line.includes("運作正常")
    ) || "",
    sample: text.slice(0, 600),
  };
}

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  const result = {
    updated: new Date().toISOString(),
  };

  for (const [key, operator] of Object.entries(operators)) {
    try {
      result[key] = await scrapeOperator(page, key, operator);
    } catch (error) {
      result[key] = {
        name: operator.name,
        reachable: false,
        normalTextFound: false,
        reports: null,
        topProblem: { label: "", share: 0 },
        level: "green",
        message: "",
        error: error.message,
      };
    }
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
