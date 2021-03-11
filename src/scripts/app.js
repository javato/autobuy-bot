const puppeteer = require('puppeteer')
const chalk = require('chalk')
const log = console.log
const data = require('../data.json')
const { getDirectoryNames } = require('../utils')

module.exports = class Bot {
  stores

  // main method
  async run() {
    try {
      this.stores = getDirectoryNames(__dirname)

      this.checkParams()

      log(`Starting bot for stores ${chalk.green(this.stores.join(', '))}`)

      // this creates a new chrome window
      const browser = await puppeteer.launch(
        data.debug ? data.browserOptions.debug : data.browserOptions.headless
      )

      const loginPage = data.debug
        ? await browser.newPage()
        : await this.createHeadlessPage(browser)

      await this.stores.forEachAsync(async store => {
        if (data[store])
          await require(`./${store}/login.js`)(loginPage, {
            email: data[store].email,
            password: data[store].password
          })
      })

      await loginPage.close()

      await this.stores.forEachAsync(async store => {
        if (data[store]) {
          const buyScript = require(`./${store}/buy.js`)
          if (Array.isArray(data[store].items)) {
            data[store].items.forEach(item => this.runItemInstance(browser, buyScript, item))
          } else {
            await this.runItemInstance(browser, buyScript, data[store].items)
          }
        }
      })
    } catch (err) {
      log(chalk.redBright('! EXCEPTION NOT CAUGHT WHILE RUNNING BOT. MORE INFO BELOW !'))
      log(chalk.whiteBright(err))
    }
  }

  async runItemInstance(browser, script, item) {
    let attempting = true
    do {
      const itemPage = await this.createHeadlessPage(browser)

      try {
        attempting = !(await script(itemPage, item))
      } catch (err) {
        log(chalk.bgRedBright.white(err))
      }
      await itemPage.close()
      if (!attempting) for (var i = 0; i < 20; i++) log(chalk.greenBright('COMPRADO'))
      else
        log(
          chalk
            .hex('#ffa500')
            .italic('ITEM NOT BOUGHT FOR WHATEVER REASON, WAITING AGAIN FOR STOCK')
        )
    } while (attempting)
  }

  checkParams() {
    const check = store =>
      store &&
      store.items &&
      store.email &&
      typeof store.email === 'string' &&
      store.password &&
      typeof store.password === 'string' &&
      store.items &&
      (Array.isArray(store.items) || typeof store.items === 'object')

    let correctStores = 0

    this.stores.forEach(store => {
      if (check(data[store])) correctStores++
    })

    if (correctStores === 0) {
      log(
        chalk.bgRed(
          'One parameter or many in file data.json is/are incorrect, compare them with the ones on github'
        )
      )
      process.exit(1)
    }
  }

  async createHeadlessPage(browser) {
    const page = await browser.newPage()

    const headlessUserAgent = await page.evaluate(() => navigator.userAgent)
    const chromeUserAgent = headlessUserAgent.replace('HeadlessChrome', 'Chrome')
    await page.setUserAgent(chromeUserAgent)
    await page.setExtraHTTPHeaders({
      'accept-language': 'en-US,en;q=0.8'
    })

    return page
  }
}
