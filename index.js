require("dotenv").config();
const { exit } = require("process");
const puppeteer = require("puppeteer");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const data = require("./config.json");

const { EMAIL: email, PASSWORD: password } = process.env;

const {
  locale,
  baseURL,
  keyword,
  workPlaceTypes,
  location,
  AvgExperience,
  periodOfTime,
  browserPath,
  resolution,
  numberOfJobsPerPage,
  avoidJobTitles,
  avoidCompanies,
} = data;

const t = require(`./i18n/${locale}.json`);

let page = "";
let browser = "";
let csvWriter = null;

function logs() {
  console.clear();
  console.log("\n==========================================\n");
  console.log(`\t${t.appTitle}`);
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

async function clickElement(selector) {
  try {
    await page.waitForSelector(selector);
    const element = await page.$(selector);
    if (element !== null) {
      await element.click();
    } else {
      console.error(`\n${t.elSelector}: "${selector}" ${t.notFound}.`);
    }
  } catch (error) {
    console.error(error);
  }
}

const pause = async (ms = 3000) => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

async function filterByKeywords() {
  const searchBox = "#global-nav > div > nav > ul > li:nth-child(3)";
  await clickElement(searchBox);
  await pause();
  await waitForSelectorAndType(
    '[id^="jobs-search-box-keyword-id"]',
    keyword.join(" OR ")
  );
}

async function filterByLocation() {
  const jobLocationSelector = '[id^="jobs-search-box-location-id"]';
  await page.evaluate((selector) => {
    const locationSelector = document.querySelector(selector);
    if (locationSelector) locationSelector.value = "";
  }, jobLocationSelector);

  await waitForSelectorAndType(jobLocationSelector, location);
}

const easyApplyFilter = async () => {
  await clickElement(".search-reusables__filter-binary-toggle");
  await pause();
};

async function filterByTime() {
  await clickElement(
    "ul.search-reusables__filter-list>li:nth-child(4)>div>span>button"
  );
  await pause(2000);
  await clickElement(
    `form > fieldset > div.pl4.pr6 > ul > li:nth-child(${
      periodOfTime === "Past 24 hours" ? 4 : 3
    }) > label`
  );
  await pause();
  await clickElement("form > fieldset > div + hr + div > button + button");
}

async function filterByType() {
  await clickElement(".search-reusables__filter-list>li:nth-child(8)>div");
  await pause(2000);

  for (const selector of Object.values(workPlaceTypes)) {
    await clickElement(selector);
  }

  await pause(2000);
  const showResultsBtn =
    ".search-reusables__filter-list>li:nth-child(8)>div>div>div>div>div>form>fieldset>div+hr+div>button+button";
  await clickElement(showResultsBtn);
}

async function Scrolling() {
  console.log(`\n${t.scroll}.....`);
  try {
    await page.evaluate(() => {
      const listOfJobs = document.querySelector(
        "div.scaffold-layout__list > div > ul"
      );
      if (listOfJobs) {
        listOfJobs.scrollIntoView();
      } else {
        console.error(`${t.el404Scroll}.`);
      }
    });
  } catch (error) {
    console.error(`${t.errorOnScroll}: \n${error}`);
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
      console.log(`${t.csvSuccess}\n`);
    })
    .catch((error) => {
      console.error(`${t.csvError}: \n${error}`);
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

const getTotalJobResult = async () => {
  const jobResultString = await page.evaluate(() => {
    const el = document.querySelector(
      "[class*='jobs-search-results-list__subtitle']"
    );
    return el ? el.innerText.split(" ")[0] : "";
  });
  return jobResultString.split(",").join("");
};

const closeJobApplicationDialog = async () => {
  await pause();
  await page.evaluate(() => {
    const xBtn = document.querySelector(
      ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
    );
    if (xBtn) xBtn.click();
  });
};

const fillAndApply = async () => {
  const totalJobCount = await getTotalJobResult();
  const maxPagination = parseInt(
    Math.ceil(parseFloat(totalJobCount) / parseFloat(numberOfJobsPerPage))
  );

  let currentPage = 1;
  let currentJobIndex = 1;

  while (currentPage <= maxPagination) {
    for (let index = 0; index < numberOfJobsPerPage; index++) {
      if (currentJobIndex > totalJobCount) {
        console.log(`\n==========\n${t.endOfScript}.\n==========`);
        exit(0);
      }
      await Scrolling();

      console.log(`${t.jobNo} [${currentJobIndex} / ${totalJobCount}]`);
      currentJobIndex++;
      const activeJob = `[class*='jobs-search-two-pane__job-card-container--viewport-tracking-${index}']>div`;

      await clickElement(activeJob);

      await pause();
      //Check for application button
      const easyApplyButton = "[class*=jobs-apply-button]>button";
      if ((await page.$(easyApplyButton)) === null) {
        console.log(t.alreadyApplied);
        continue;
      }

      let companyName = await getCompanyName();
      const containsUnwantedCompanyName = avoidCompanies.some((name) =>
        companyName?.toLowerCase().includes(name?.toLowerCase())
      );

      if (containsUnwantedCompanyName) {
        console.log(`${t.skipCompany}: ${companyName}`);
        continue;
      }

      const jobTitle = await getJobTitle();
      const jobLink = await getLink();

      // Check if the job title is in the list of titles to avoid
      const jobTitleRegex = new RegExp(
        `\\b(${avoidJobTitles
          .map((title) => title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
          .join("|")})(?=\\b|[^a-zA-Z0-9])`,
        "i"
      );
      if (jobTitleRegex.test(jobTitle)) {
        console.log(`${t.skipTitle}: ${jobTitle}`);
        continue;
      }
      console.log(`${t.applyTo} ${jobTitle} ...`);

      await pause();
      const easyApplyLimitReached = await page.evaluate(() => {
        const easyApplyLimitEl = document.querySelector(
          ".artdeco-inline-feedback__message"
        );
        return easyApplyLimitEl && easyApplyLimitEl.innerText.includes("limit");
      });

      if (easyApplyLimitReached) {
        console.log(`==========\n${t.limit}...\n==========`);
        exit(0);
      }

      await clickElement(easyApplyButton);

      // Check to see if the "Job search safety reminder" dialog is displayed
      await pause();
      await page.evaluate(() => {
        const continueApplyingButton = document.querySelector(
          'div[class="artdeco-modal__actionbar ember-view job-trust-pre-apply-safety-tips-modal__footer"]>button+div>div>button'
        );
        if (continueApplyingButton) continueApplyingButton.click();
      });

      const isSingleStepApplication = await page.evaluate(() => {
        const submitOrNextBtn = document.querySelector(
          'div[class="display-flex justify-flex-end ph5 pv4"]>button'
        );
        if (submitOrNextBtn.innerText.toLowerCase().includes("submit")) {
          submitOrNextBtn.click();
          return true;
        }
        return false;
      });

      if (isSingleStepApplication) await closeJobApplicationDialog();

      let skipped = false;
      let firstPage = true;

      while (firstPage == true && !isSingleStepApplication) {
        if (
          await page.evaluate(() => {
            const nextBtn = document.querySelector(
              'div[class="display-flex justify-flex-end ph5 pv4"]>button'
            );
            if (nextBtn) nextBtn.click();
          })
        ) {
          firstPage = true;
        } else {
          firstPage = false;
          break;
        }
        await pause();
      }
      if (firstPage == false && !isSingleStepApplication) {
        const nextBtn =
          'div[class="display-flex justify-flex-end ph5 pv4"]>button + button';
        await clickElement(nextBtn);
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

        let counter = 30;
        let finalPage = false;
        do {
          await pause();
          const modalExists = await page.$(
            'div[class*="artdeco-modal-overlay"]>div>div+div>div>button>span'
          );
          if (!modalExists) {
            counter--;
            process.stdout.write(`\r${t.waiting}: ${counter}${t.remains}`);

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
          } else {
            counter = -2;
          }
        } while (counter > 0 && counter <= 30 && finalPage === false);

        if (finalPage === false) {
          // due to inactivity, skip the job
          await pause();
          await clickElement(
            ".artdeco-modal__dismiss.artdeco-button.artdeco-button--circle.artdeco-button--muted.artdeco-button--2.artdeco-button--tertiary.ember-view"
          );
          await pause();
          await clickElement(
            '[data-control-name="discard_application_confirm_btn"]'
          );
          skipped = true;
          console.log(`\n${t.jobSkipped}`);
        } else {
          await closeJobApplicationDialog();
        }
      }
      // Add the Job to the CSV file
      writeInCSV({
        jobTitle: jobTitle,
        link: jobLink,
        status: skipped ? "Skipped" : "Applied",
      });
    }

    await Scrolling();
    console.log(`${t.scrolledPage} ${currentPage}`);

    if (currentPage < maxPagination) {
      await clickElement(
        `ul[class="artdeco-pagination__pages artdeco-pagination__pages--number"]>li:nth-child(${
          currentPage + 1
        })`
      );
    }

    currentPage++;
  }
};

async function filterAndSearch() {
  await filterByKeywords();
  await pause(1000);
  await filterByLocation();
  await page.keyboard.press("Enter");
  await pause(1000);
  await easyApplyFilter();
  await filterByTime();
  await pause();
  await filterByType();
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
