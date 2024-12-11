require("dotenv").config();
const { exit } = require("process");
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
  avoidCompanyNames,
} = data;

let page = "";
let browser = "";
let csvWriter = null;

function logs() {
  console.clear();
  console.log("\n==========================================\n");
  console.log("\tLinkedIn Easy Apply Bot");
  console.log("\n==========================================\n");
}

async function login() {
  await findTargetAndType('[name="session_key"]', email);
  await findTargetAndType('[name="session_password"]', password);
  page.keyboard.press("Enter");
}

async function initializer() {
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

const pause = async (ms = 3000) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function jobCriteriaByKeywords() {
  const searchBox = "#global-nav > div > nav > ul > li:nth-child(3)";
  await buttonClick(searchBox);
  await pause();
  await waitForSelectorAndType(
    '[id^="jobs-search-box-keyword-id"]',
    keyword.join(" OR ")
  );
}

async function jobCriteriaByLocation() {
  const jobLocationSelector = '[id^="jobs-search-box-location-id"]';
  await page.evaluate((selector) => {
    const locationSelector = document.querySelector(selector);
    if (locationSelector) locationSelector.value = "";
  }, jobLocationSelector);

  await waitForSelectorAndType(jobLocationSelector, location);
}

async function jobCriteriaByTime() {
  await buttonClick(".search-reusables__filter-binary-toggle");
  await pause();
  await buttonClick(
    "ul.search-reusables__filter-list>li:nth-child(4)>div>span>button"
  );
  if (periodOfTime == "Past 24 hours") {
    // apply to the jobs posted in the last 24 hrs
    await pause();
    await buttonClick(
      "form > fieldset > div.pl4.pr6 > ul > li:nth-child(4) > label"
    );
    await pause();
    await buttonClick("form > fieldset > div + hr + div > button + button");
  } else {
    // apply to the jobs posted within the past week
    await pause();
    await buttonClick(
      "form > fieldset > div.pl4.pr6 > ul > li:nth-child(3) > label"
    );
    await pause();
    await buttonClick("form > fieldset > div + hr + div > button + button");
  }
}

async function jobCriteriaByType() {
  await buttonClick(".search-reusables__filter-list>li:nth-child(8)>div");
  await pause();

  await buttonClick(workPlaceTypes.remote);
  await buttonClick(workPlaceTypes.hybrid);
  await buttonClick(workPlaceTypes.onsite);

  await pause();
  await buttonClick(
    ".search-reusables__filter-list>li:nth-child(8)>div>div>div>div>div>form>fieldset>div+hr+div>button+button"
  ); // click the `show results` button
  await pause();
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
  console.log("\nScrolling.....");
  try {
    await page.evaluate(() => {
      const listOfJobs = document.querySelector(
        "div.scaffold-layout__list > div > ul"
      );
      if (listOfJobs) {
        listOfJobs.scrollIntoView();
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
    .writeRecords([data])
    .then(() => {
      console.log("CSV file written successfully");
    })
    .catch((error) => {
      console.error("Error writing new entry:", error);
    });
}

async function getCompanyName() {
  const companyNameSelector =
    ".job-details-jobs-unified-top-card__company-name>a";

  const companyName = await page.evaluate((selector) => {
    const element = document.querySelector(selector);
    return element ? element.text : null;
  }, companyNameSelector);

  return companyName;
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

async function fillAndApply() {
  let i = 1;
  let lastIndexForPagination = 1;
  // TODO: calculate `numberOfPagination` properly using number of jobs in the search and number of jobs per page
  // TODO:  Also break out of the loop and end the app when we have reached the last job.
  while (i <= numberOfPagination) {
    for (let index = 1; index <= numberOfOffersPerPage; index++) {
      let state = true;
      await Scrolling();
      // TODO: change the index to use the current overall job number / the total number of jobs
      console.log(`Apply N°[${index}]`);
      const activeJob = `[class*='jobs-search-two-pane__job-card-container--viewport-tracking-${
        index - 1
      }']>div`;

      if ((await page.$(activeJob)) != null) {
        await buttonClick(activeJob);
      }

      if (index === numberOfOffersPerPage) lastIndexForPagination++;

      await pause();
      //Check for application button
      if ((await page.$("[class*=jobs-apply-button]>button")) != null) {
        let companyName = await getCompanyName();

        const containsUnwantedCompanyName = avoidCompanyNames.some((name) =>
          companyName?.toLowerCase().includes(name?.toLowerCase())
        );

        if (containsUnwantedCompanyName) {
          console.log(`Skipping this job from company: ${companyName}`);
          continue;
        }

        let jobTitle = await getJobTitle();
        console.log("jobTitle: " + jobTitle);
        let jobLink = await getLink();
        console.log("jobLink: " + jobLink);

        // Check if the job title is in the list of titles to avoid
        const jobTitleRegex = new RegExp(
          `\\b(${avoidJobTitles
            .map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|")})(?=\\b|[^a-zA-Z0-9])`,
          "i"
        );
        if (jobTitleRegex.test(jobTitle)) {
          console.log(`Skipping job with title: ${jobTitle}`);
          continue;
        }
        console.log(`Applying to ${jobTitle} ...`);

        await pause();
        const easyApplyLimitReached = await page.evaluate(() => {
          const easyApplyLimitEl = document.querySelector(
            ".artdeco-inline-feedback__message"
          );
          return (
            easyApplyLimitEl && easyApplyLimitEl.innerText.includes("limit")
          );
        });

        if (easyApplyLimitReached) {
          console.log(
            "==========\nYou've reached the Easy Apply application limit for today. Exiting the app...\n=========="
          );
          exit(0);
        }

        const easyApplyButton = 'div[class*="jobs-apply-button"]>button';
        await buttonClick(easyApplyButton);

        // Check to see if the "Job search safety reminder" dialog comes up instead
        await pause();
        await page.evaluate(() => {
          const continueApplyingButton = document.querySelector(
            'div[class="artdeco-modal__actionbar ember-view job-trust-pre-apply-safety-tips-modal__footer"]>button+div>div>button'
          );
          if (continueApplyingButton) continueApplyingButton.click(); // Click the "Continue applying" button in the "Job search safety reminder" dialog
        });

        while (state == true) {
          await pause();
          if (
            await page.evaluate(() => {
              const nextBtn = document.querySelector(
                'div[class="display-flex justify-flex-end ph5 pv4"]>button'
              );
              if (nextBtn) nextBtn.click(); // Click the "Next" button in the Apply dialog
            })
          ) {
            state = true;
          } else {
            state = false;
            break;
          }
          await pause();
        }
        if (state == false) {
          // TODO: add `await page.evaluate()` to the element below, test with kforce jobs or jobs that only have one page.
          await clickElement(
            'div[class="display-flex justify-flex-end ph5 pv4"]>button + button'
          );
          await pause();

          // TODO: This part currently does nothing but should be used to auto input, to be done later.
          // if (
          //   (await page.$(
          //     'input[class="ember-text-field ember-view fb-single-line-text__input"]'
          //   )) != null
          // ) {
          //   await page.evaluate(() => {
          //     const divElem = document.querySelector("div.pb4");
          //     const inputElements = divElem.querySelectorAll("input");
          //     let value = 3;
          //     var nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          //       window.HTMLInputElement.prototype,
          //       "value"
          //     ).set;
          //     for (let index = 0; index < inputElements.length; index++) {
          //       nativeInputValueSetter.call(inputElements[index], value);
          //       var inputEvent = new Event("input", { bubbles: true });
          //       inputElements[index].dispatchEvent(inputEvent);
          //     }
          //   });
          // }
          let counter = 0;
          let finalPage = false;
          do {
            await pause();
            const modalExists = await page.$(
              'div[class*="artdeco-modal-overlay"]>div>div+div>div>button>span'
            );
            if (!modalExists) {
              counter++;
              console.log("counter: " + counter);

              finalPage = await page.evaluate(() => {
                const nextButton = document.querySelector(
                  'div[class="display-flex justify-flex-end ph5 pv4"]>button + button'
                );
                if (nextButton) {
                  nextButton.click();
                  return false;
                } else {
                  return true;
                }
              });
            } else counter = -2;
          } while (counter >= 0 && counter < 20 && finalPage === false);

          let skipped = false;
          if (counter >= 5 && finalPage === false) {
            // due to inactivity, skip the job
            await pause();
            await buttonClick(
              ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
            );
            await pause();
            await buttonClick(
              '[data-control-name="discard_application_confirm_btn"]'
            );
            skipped = true;
            console.log("Job Skipped");
          } else {
            // Finish the job application by closing the dialog with the `X` button.
            await pause();
            await page.evaluate(() => {
              const xBtn = document.querySelector(
                ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
              );
              if (xBtn) xBtn.click();
            });
          }

          // Add the Job to the CSV file
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
    console.log(`Finished scrolling page N° ${i}`);
    i++;
  }
}

async function filterAndSearch() {
  await jobCriteriaByKeywords();
  await pause(1000);
  await jobCriteriaByLocation();
  await page.keyboard.press("Enter");
  await pause(1000);
  await jobCriteriaByTime();
  await pause();
  await jobCriteriaByType();
  await pause();
}

async function main() {
  logs();
  await initializer();
  await login();
  await filterAndSearch();
  await fillAndApply();
  await browser.close();
}

main();
