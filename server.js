const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");
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

// function buildChoices(correctOffense) {
//   const pool = [
//     "BURGLARY", "FRAUD", "ROBBERY", "AGGRAVATED ASSAULT",
//     "ARMED ROBBERY", "MURDER", "ATMPT MURDER", "ARSON", "KIDNAPPING", "DRVNG HABTL VIOLATOR"
//   ].filter(x => x !== correctOffense);
//   const wrong = shuffle(pool).slice(0, 3);
//   return shuffle([correctOffense, ...wrong]);
// }

function normalizeOffense(str) {
  return (str || "").replace(/\s+/g, " ").trim().toUpperCase();
}

function weightedPick(pool) {
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  let random = Math.random() * totalWeight;

  for (const item of pool) {
    random -= item.weight;
    if (random <= 0) {
      return item;
    }
  }

  return pool[pool.length - 1];
}


function buildChoices(correctOffense) {
  const correct = normalizeOffense(correctOffense);

  const wrongAnswerPool = [
    { offense: "BURGLARY", weight: 9 },
    { offense: "FRAUD", weight: 5 },
    { offense: "ROBBERY", weight: 9 },
    { offense: "AGGRAV ASSAULT", weight: 10 },
    { offense: "ARMED ROBBERY", weight: 7 },
    { offense: "MURDER", weight: 3 },
    { offense: "ATMPT MURDER", weight: 2 },
    { offense: "ARSON", weight: 2 },
    { offense: "DRVNG HABTL VIOLATOR", weight: 8 },
    { offense: "HABIT TRAF VIOL/OTHER", weight: 6 },
    { offense: "POSS OF FIREARM DUR CRIME", weight: 2 },
    { offense: "POSS W INT DIST COCAINE", weight: 4 },
    { offense: "POSS W INT DIST METH", weight: 3 },
    { offense: "POSS W INT DIST FENTANYL", weight: 2 },
    { offense: "POSS W INT DIST MARIJUANA", weight: 6 },
    { offense: "VIOL DNGROUS DRGS ACT", weight: 2 },
    { offense: "CRMNL DAMAGE 2ND DEGREE", weight: 4 },
    { offense: "MURDER 2ND DEGREE", weight: 1 },
    { offense: "POSS FIREARM CONVCT FELON", weight: 7 },
    { offense: "AGGRAV BATTERY", weight: 8 },
    { offense: "BURG BEF 7/1/12", weight: 2 },
    { offense: "OBSTR OF LAW ENF OFFICER", weight: 5 },
    { offense: "CHILD MOLESTATION", weight: 1 },
    { offense: "THEFT BY TAKING", weight: 3 },
    { offense: "AGGRAV ASSAULT PEACE OFCR", weight: 3 },
    { offense: "VOLUNTARY MANSLAUGHTER", weight: 2 },
    { offense: "INVOLUNTARY MANSLAUGHTER", weight: 1 },
    { offense: "THEFT BY REC STOLEN PROP", weight: 3 },
    { offense: "AGGRAV SEXUAL BATTERY", weight: 2 },
    { offense: "POSS NARCOTICS OPIATES", weight: 4 },
    { offense: "POSS METHAMPHETAMINE", weight: 3 },
    { offense: "S/D COCAINE", weight: 1 },
    { offense: "FORG 1ST BEF 7/1/12", weight: 1 },
    { offense: "POSS COCAINE", weight: 3 },
    { offense: "POSS OF MARIJUANA", weight: 6 },
    { offense: "SEX EXPLOITATION CHILD", weight: 3 },
    { offense: "TRAF METHAMPH 28-199 GM", weight: 3 },
    { offense: "RAPE", weight: 2 },
    { offense: "FAMILY VIOLENCE BATTERY", weight: 3 },
    { offense: "DOMESTIC VIOLENCE", weight: 5 },
    { offense: "TRAF COCAINE LESS 200 GM", weight: 1 },
    { offense: "TRAF COCAINE MORE 200 GM", weight: 1 },
    { offense: "TRAF METHAMPH 400+ GM", weight: 1 },
    { offense: "TRAF METH LESS 400 GM", weight: 1 },
    { offense: "TERRORIST THREATS & ACTS", weight: 2 },
    { offense: "ANIMAL CRUELTY", weight: 1 },
    { offense: "CHILD ABUSE", weight: 2 },
    { offense: "MISC CORRECTIONL INST OFF", weight: 3 },
    { offense: "BURG 2ND AFT 6/30/12", weight: 2 },
    { offense: "KIDNAPPING", weight: 2 },
    { offense: "THEFT MOTORVEH OR PART", weight: 6 },
    { offense: "THEFT CREDIT CARD", weight: 1 }
  ]
    .map(item => ({
      offense: normalizeOffense(item.offense),
      weight: item.weight
    }))
    .filter(item => item.offense !== correct);

  const chosenWrong = [];
  const used = new Set();

  while (chosenWrong.length < 3 && wrongAnswerPool.length > 0) {
    const available = wrongAnswerPool.filter(item => !used.has(item.offense));
    if (!available.length) break;

    const picked = weightedPick(available);
    chosenWrong.push(picked.offense);
    used.add(picked.offense);
  }

  return shuffle([correct, ...chosenWrong]);
}






app.post("/random-case", async (req, res) => {
  const { ageLow = 18, ageHigh = 90 } = req.body;
  let browser;

  try {
    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // ── STEP 1: Navigate to disclaimer page ──────────────────────────────────
    await page.goto(
      "https://services.gdc.ga.gov/GDC/OffenderQuery/jsp/OffQryForm.jsp",
      { waitUntil: "networkidle2", timeout: 30000 }
    );

    // ── STEP 2: Submit disclaimer form if present ─────────────────────────────
    const hasDisclaimer = await page.$('#submit2');
    if (hasDisclaimer) {
      console.log("Disclaimer form found — submitting...");
      await Promise.all([
        page.click('#submit2'),
        page.waitForNavigation({ waitUntil: "networkidle2", timeout: 30000 })
      ]);
    }

    // ── STEP 3: Wait for search form and fill age range ───────────────────────
    await page.waitForSelector("#vAgeLow", { timeout: 20000 });

    await page.click("#vAgeLow", { clickCount: 3 });
    await page.type("#vAgeLow", String(ageLow));

    await page.waitForSelector("#vAgeHigh", { timeout: 10000 });
    await page.click("#vAgeHigh", { clickCount: 3 });
    await page.type("#vAgeHigh", String(ageHigh));


    // RANDOMIZE SEARCH

    // Generate random letters
    const randomFirstLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
    const randomLastLetter  = String.fromCharCode(65 + Math.floor(Math.random() * 26));

    console.log("Random query:", randomFirstLetter, randomLastLetter);

    // Fill FIRST NAME
    await page.waitForSelector("#vFirstName", { timeout: 10000 });
    await page.click("#vFirstName", { clickCount: 3 });
    await page.type("#vFirstName", randomFirstLetter);

    // Fill LAST NAME
    await page.waitForSelector("#vLastName", { timeout: 10000 });
    await page.click("#vLastName", { clickCount: 3 });
    await page.type("#vLastName", randomLastLetter);


    // -----------------------------


    await page.waitForSelector("#NextButton2", { timeout: 10000 });
    await Promise.all([
      page.click("#NextButton2"),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
    ]);

    // ── STEP 4: Pick a random inmate ──────────────────────────────────────────
    await page.waitForSelector('input[name="btn1"]', { timeout: 20000 }).catch(() => {
      throw new Error("No results found for this age range.");
    });

    const buttons = await page.$$('input[name="btn1"]');
    if (!buttons.length) throw new Error("No inmate buttons found.");

    const randomIndex = Math.floor(Math.random() * buttons.length);
    console.log(`Found ${buttons.length} inmates. Selecting index: ${randomIndex}`);

    await Promise.all([
      buttons[randomIndex].click(),
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 })
    ]);

    // ── STEP 5: Parse profile ─────────────────────────────────────────────────
    await page.waitForSelector("h4", { timeout: 15000 }).catch(() => {
      throw new Error("Inmate profile did not load.");
    });

    const html = await page.content();
    const $ = cheerio.load(html);

    const imgSrc = $('img[alt="Image of the offender"]').attr("src") || "";
    const fullImgUrl = imgSrc.startsWith("http")
      ? imgSrc
      : `https://services.gdc.ga.gov${imgSrc}`;

    // ── STEP 6: Fetch image as base64 using same session ──────────────────────
    let imageBase64 = "";
    if (fullImgUrl) {
      try {
        const imgResponse = await page.goto(fullImgUrl, { waitUntil: "networkidle2", timeout: 10000 });
        const imgBuffer = await imgResponse.buffer();
        imageBase64 = `data:image/jpeg;base64,${imgBuffer.toString("base64")}`;
        console.log("Image fetched successfully.");
      } catch (e) {
        console.error("Image fetch failed:", e.message);
      }
    }

    const name = $("h4").first().text().trim().replace("NAME:", "").trim();

    function getValue(label) {
      const strong = $("strong.offender")
        .filter((i, el) => $(el).text().includes(label))
        .first();
      if (!strong.length) return "";
      return strong[0].nextSibling?.nodeValue?.trim() ||
        strong.parent().text()
          .replace(strong.text(), "")
          .split(/[A-Z]{3,}:/)[0]
          .replace(/\s+/g, " ")
          .trim();
    }

    

    const offense = getValue("MAJOR OFFENSE");

    const offenderData = {
      name,
      image: imageBase64,
      yob:         getValue("YOB"),
      race:        getValue("RACE"),
      gender:      getValue("GENDER"),
      height:      getValue("HEIGHT"),
      weight:      getValue("WEIGHT"),
      eyeColor:    getValue("EYE COLOR"),
      hairColor:   getValue("HAIR COLOR"),
      offense,
      institution: getValue("MOST RECENT INSTITUTION"),
      releaseDate: getValue("MAX POSSIBLE RELEASE DATE"),
      choices:     buildChoices(offense)
    };

    console.log("SUCCESS — Scraped:", offenderData.name, "|", offenderData.offense);
    res.json(offenderData);

  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({ error: "Scrape failed", detail: err.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// THE BAD

// Page too zoomed in, make loading faster, block answering before laod and make loading symbol replace picture.

// THE GOOD

// Add vais, epstein, diddy, EDP, david, any other popular prisoners, DANGER score and other in html