const puppeteer = require("puppeteer");
const fs = require("fs/promises");

const url = "https://downdetector.tw/status/far-eastone-telecommunications-fet-yuan-chuan-dian-xin/";

async function main() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
  );

  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  const text = await page.evaluate(() => document.body.innerText);
  await browser.close();

  const okText =
    text.includes("運作正常") ||
    text.includes("no current problems") ||
    text.includes("User reports show no current problems");

  const result = {
    updated: new Date().toISOString(),
    fet: {
      reachable: true,
      normalTextFound: okText,
      sample: text.slice(0, 1000),
    },
  };

  await fs.writeFile("network-status-poc.json", JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async (error) => {
  const result = {
    updated: new Date().toISOString(),
    fet: {
      reachable: false,
      error: error.message,
    },
  };

  await fs.writeFile("network-status-poc.json", JSON.stringify(result, null, 2), "utf8");
  console.error(error);
  process.exitCode = 1;
});
