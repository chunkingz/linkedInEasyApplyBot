require("dotenv").config();
const puppeteer = require("puppeteer");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const data = require("./config.json");

const { EMAIL: email, PASSWORD: password } = process.env;

const {
  baseURL,
  keyword,
  workPlaceTypes,
  location,
  AvgExperience,
  periodOfTime,
  browserPath,
  resolution,
  numberOfPagination,
  numberOfOffersPerPage,
  avoidJobTitles,
} = data;

let page = "";
let browser = "";
let csvWriter = null;

async function logs() {
  console.log("mydata is :" + JSON.stringify(data));
  console.log("\n================================================\n");
}

async function Login() {
  await findTargetAndType('[name="session_key"]', email);
  await findTargetAndType('[name="session_password"]', password);
  page.keyboard.press("Enter");
}

async function initiliazer() {
  browser = await puppeteer.launch({
    headless: false,
    executablePath: browserPath,
    args: [resolution],
    defaultViewport: null,
    timeout: 60000,
    // userDataDir: "./userData",
  });
  page = await browser.newPage();
  const pages = await browser.pages();
  if (pages.length > 1) {
    await pages[0].close();
  }
  await page.goto(baseURL);

  csvWriter = createCsvWriter({
    path: "report.csv",
    header: [
      { id: "jobTitle", title: "Job Title" },
      { id: "link", title: "Link" },
      { id: "status", title: "Status" },
    ],
  });
}

async function findTargetAndType(target, value) {
  const f = await page.$(target);
  await f.type(value);
}

async function waitForSelectorAndType(target, value) {
  const typer = await page.waitForSelector(target, { visible: true });
  await typer.type(value);
}

async function buttonClick(selector) {
  try {
    await page.waitForSelector(selector);
    const buttonClick = await page.$(selector);
    await buttonClick.click();
  } catch (error) {
    console.error(`Error clicking element with selector '${selector}':`, error);
  }
}

async function jobCriteriaByTime() {
  await buttonClick(".search-reusables__filter-binary-toggle");
  await page.waitForTimeout(2000);
  await buttonClick(
    "ul.search-reusables__filter-list>li:nth-child(4)>div>span>button"
  );
  if (periodOfTime == "Past 24 hours") {
    // apply to the jobs posted in the last 24 hrs
    await page.waitForTimeout(2000);
    await buttonClick(
      "form > fieldset > div.pl4.pr6 > ul > li:nth-child(4) > label"
    );
    await page.waitForTimeout(2000);
    await buttonClick("form > fieldset > div + hr + div > button + button");
  } else {
    // apply to the jobs posted within the past week
    await page.waitForTimeout(2000);
    await buttonClick(
      "form > fieldset > div.pl4.pr6 > ul > li:nth-child(3) > label"
    );
    await page.waitForTimeout(2000);
    await buttonClick("form > fieldset > div + hr + div > button + button");
  }
}

async function jobCriteriaByType() {
  await buttonClick(
    ".search-reusables__filter-list>li:nth-child(8)>div"
  );
  await page.waitForTimeout(2000);

  await buttonClick(workPlaceTypes.remote);
  await buttonClick(workPlaceTypes.hybrid);
  await buttonClick(workPlaceTypes.onsite);

  await page.waitForTimeout(2000);
  await buttonClick(
    ".search-reusables__filter-list>li:nth-child(8)>div>div>div>div>div>form>fieldset>div+hr+div>button+button"
  ); // click the `show results` button
  await page.waitForTimeout(2000);
}

async function clickElement(selector) {
  try {
    const element = await page.$(selector);
    if (element !== null) {
      await element.click();
    } else {
      console.error(`Element with selector '${selector}' not found.`);
    }
  } catch (error) {
    console.error(`Error clicking element with selector '${selector}':`, error);
  }
}

async function Scrolling() {
  console.log("Scrolling.....");
  try {
    await page.evaluate(() => {
      const element = document.querySelector(
        "div.scaffold-layout__list > div > ul"
      );
      console.log("element: " + element);
      if (element) {
        element.scrollIntoView();
      } else {
        console.error("Element not found for scrolling.");
      }
    });
  } catch (error) {
    console.error("Error scrolling:", error);
  }
}

function changeValue(input, value) {
  var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  ).set;
  nativeInputValueSetter.call(input, value);
  var inputEvent = new Event("input", { bubbles: true });
  input.dispatchEvent(inputEvent);
}

function writeInCSV(data) {
  csvWriter
    .writeRecords([data]) // Write data to CSV
    .then(() => {
      console.log("CSV file written successfully");
    })
    .catch((error) => {
      console.error("Error writing new entry:", error);
    });
}

async function getJobTitle() {
  const jobTitleSelector = ".job-details-jobs-unified-top-card__job-title>h1>a";

  const jobTitle = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    return element ? element.text : null;
  }, jobTitleSelector);

  return jobTitle;
}

async function getLink() {
  const jobLinkSelector = ".job-details-jobs-unified-top-card__job-title>h1>a";

  const jobLink = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    return element ? element.href : null;
  }, jobLinkSelector);

  return jobLink;
}

async function FillAndApply() {
  let i = 1;
  let lastIndexForPagination = 1;
  while (i <= numberOfPagination) {
    console.log("Scrolling the page N°" + i);

    for (let index = 1; index <= numberOfOffersPerPage; index++) {
      let state = true;
      await page.waitForTimeout(3000);
      await Scrolling();
      console.log(`Apply N°[${index}]`);
      if (
        (await page.$(
          `li[class*="jobs-search-results__list-item"]:nth-child(${index})>div>div`
        )) != null
      ) {
        await buttonClick(
          `li[class*="jobs-search-results__list-item"]:nth-child(${index})>div>div`
        );
      }
      if (index === numberOfOffersPerPage) lastIndexForPagination++;

      await page.waitForTimeout(2000);
      //Check for application button
      if ((await page.$("[class*=jobs-apply-button]>button")) != null) {
        // Get the job title
        let jobTitle = await getJobTitle();
        console.log("jobTitle: " + jobTitle);
        let jobLink = await getLink();
        console.log("jobLink: " + jobLink);

        // Check if the job title is in the list of titles to avoid
        const jobTitleRegex = new RegExp(
          `\\b(${avoidJobTitles.map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join("|")})(?=\\b|[^a-zA-Z0-9])`,
          "i"
        );
        if (jobTitleRegex.test(jobTitle)) {
          console.log(`Skipping job with title: ${jobTitle}`);
          continue; // Skip this job and continue to the next one
        }
        console.log(`Applying to ${jobTitle} ...`);

        // Click the "Easy Apply" button
        await clickElement("[class*=jobs-apply-button]>button");

        // Check to see if the "Job search safety reminder" dialog comes up instead
        await page.waitForTimeout(2000);
        await page.evaluate(() => {
          setTimeout(() => {}, 3000);
          const continueApplyingButton = document.querySelector(
            'div[class="artdeco-modal__actionbar ember-view job-trust-pre-apply-safety-tips-modal__footer"]>button+div>div>button'
          );
          if (continueApplyingButton != null) {
            continueApplyingButton.click(); // Click the "Continue applying" button in the "Job search safety reminder" dialog
          }
        });

        while (state == true) {
          await page.waitForTimeout(2000);
          if (
            await page.evaluate(() => {
              setTimeout(() => {}, 3000);
              document
                .querySelector(
                  'div[class="display-flex justify-flex-end ph5 pv4"]>button'
                )
                .click(); // Click the "Next" button in the Apply dialog
            })
          ) {
            state = true;
          } else {
            state = false;
            break;
          }
          await page.waitForTimeout(3000);
        }
        if (state == false) {
          await page.waitForTimeout(3000);
          await clickElement(
            'div[class="display-flex justify-flex-end ph5 pv4"]>button + button'
          );
          await page.waitForTimeout(3000);

          if (
            (await page.$(
              'input[class="ember-text-field ember-view fb-single-line-text__input"]'
            )) != null
          ) {
            await page.evaluate(() => {
              const divElem = document.querySelector("div.pb4");
              const inputElements = divElem.querySelectorAll("input");
              let value = 3;
              var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                window.HTMLInputElement.prototype,
                "value"
              ).set;
              for (let index = 0; index < inputElements.length; index++) {
                setTimeout(() => {}, 2000);
                nativeInputValueSetter.call(inputElements[index], value);
                var inputEvent = new Event("input", { bubbles: true });
                inputElements[index].dispatchEvent(inputEvent);
              }
            });
          }
          let counter = 0;
          do {
            await page.waitForTimeout(4000);
            if (
              !(await page.$(
                'div[class*="artdeco-modal-overlay"]>div>div+div+div>button>span'
                // 'div[class*=artdeco-modal-overlay]>div>div+div>div>div+div>form>div+footer>div+div>button>span' // proposed change
              ))
            ) {
              counter++;
              console.log("counter: " + counter);
              await page.evaluate(() => {
                setTimeout(() => {}, 3000);
                document
                  .querySelector(
                    'div[class="display-flex justify-flex-end ph5 pv4"]>button + button'
                    // 'div[class="display-flex justify-flex-end ph5 pv4"]>#ember380'
                    // '.display-flex justify-flex-end ph5 pv4>#ember380'  // proposed change
                  )
                  .click();
              });
            } else counter = -2;
          } while (counter >= 0 && counter < 20);

          let skipped = false;
          if (counter >= 5) {
            await buttonClick(
              ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
            );
            await page.waitForTimeout(4000);
            await buttonClick(
              '[data-control-name="discard_application_confirm_btn"]'
            );
            skipped = true;
            console.log("Job Skipped");
          } else {
            await page.waitForTimeout(4000);
            await page.evaluate(() => {
              setTimeout(() => {}, 3000);
              document
                .querySelector(
                  ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
                )
                .click();
            });
          }

          //Write in csv
          writeInCSV({
            jobTitle: jobTitle,
            link: "https://www.linkedin.com" + jobLink,
            status: skipped ? "Skipped" : "Applied",
          });
        }
      }
    }

    await Scrolling();
    await buttonClick(
      `ul[class="artdeco-pagination__pages artdeco-pagination__pages--number"]>li:nth-child(${lastIndexForPagination})`
    );
    i++;
    console.log("finished Scrolling page N°" + (i - 1));
  }
}

async function jobsApply() {
  await buttonClick("#global-nav > div > nav > ul > li:nth-child(3)");
  await waitForSelectorAndType(
    '[id^="jobs-search-box-keyword-id"]',
    keyword.join(" OR ")
  );
  // await waitForSelectorAndType('[id^="jobs-search-box-location-id"]', location);
  await page.waitForTimeout(2000);
  await page.keyboard.press("Enter");
  await jobCriteriaByTime();
  await page.waitForTimeout(4000);
  await jobCriteriaByType();
  await page.waitForTimeout(4000);
  await FillAndApply();
}

async function main() {
  logs();
  await initiliazer();
  await Login();
  await jobsApply();
  await browser.close();
}

main();
