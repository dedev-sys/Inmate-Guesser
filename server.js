const puppeteer = require("puppeteer");
const cheerio = require("cheerio");
const express = require("express");

const app = express();

app.use(express.json());
app.use(express.static("."));

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildChoices(correctOffense) {
  const pool = [
    "BURGLARY",
    "FRAUD",
    "ROBBERY",
    "AGGRAVATED ASSAULT",
    "ARMED ROBBERY",
    "MURDER",
    "ATMPT MURDER",
    "ARSON",
    "KIDNAPPING"
  ].filter(x => x !== correctOffense);

  const wrong = shuffle(pool).slice(0, 3);
  return shuffle([correctOffense, ...wrong]);
}

app.post("/random-case", async (req, res) => {
  const { ageLow = 18, ageHigh = 90 } = req.body;

  let browser;

  try {
    browser = await puppeteer.launch({ headless: "new" });
    const page = await browser.newPage();

    await page.goto("https://services.gdc.ga.gov/GDC/OffenderQuery/jsp/OffQryForm.jsp", {
      waitUntil: "networkidle2"
    });

    await page.click("#vAgeLow", { clickCount: 3 });
    await page.type("#vAgeLow", String(ageLow));

    await page.click("#vAgeHigh", { clickCount: 3 });
    await page.type("#vAgeHigh", String(ageHigh));

    await Promise.all([
      page.click("#NextButton2"),
      page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    await page.waitForSelector('input[name="btn1"]');

    const buttons = await page.$$('input[name="btn1"]');

    if (!buttons.length) {
      throw new Error("No buttons found");
    }

    const randomIndex = Math.floor(Math.random() * buttons.length);
    console.log("Fetching inmate index:", randomIndex);

    await Promise.all([
      buttons[randomIndex].click(),
      page.waitForNavigation({ waitUntil: "networkidle2" })
    ]);

    const html = await page.content();
    const $ = cheerio.load(html);

    const imgSrc = $('img[alt="Image of the offender"]').attr("src") || "";
    const image = imgSrc.startsWith("http")
      ? imgSrc
      : `https://services.gdc.ga.gov${imgSrc}`;

    const nameRaw = $("h4").first().text().trim();
    const name = nameRaw.replace("NAME:", "").trim();

    function getValue(label) {
      const strong = $("strong.offender")
        .filter((i, el) => $(el).text().includes(label))
        .first();

      if (!strong.length) {
        return "";
      }

      return strong.parent().text()
        .replace(strong.text(), "")
        .replace(/\s+/g, " ")
        .trim();
    }

    const yob = getValue("YOB");
    const race = getValue("RACE");
    const gender = getValue("GENDER");
    const height = getValue("HEIGHT");
    const weight = getValue("WEIGHT");
    const eyeColor = getValue("EYE COLOR");
    const hairColor = getValue("HAIR COLOR");
    const offense = getValue("MAJOR OFFENSE");
    const institution = getValue("MOST RECENT INSTITUTION");
    const releaseDate = getValue("MAX POSSIBLE RELEASE DATE");

    const offenderData = {
      name,
      image,
      yob,
      race,
      gender,
      height,
      weight,
      eyeColor,
      hairColor,
      offense,
      institution,
      releaseDate,
      choices: buildChoices(offense)
    };

    console.log(offenderData);
    res.json(offenderData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Scrape failed" });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});