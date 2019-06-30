require('dotenv').config()
const logger = require('pino')({ level: process.env.LOG_LEVEL || 'info', prettyPrint: { translateTime: true } })

async function runMain() {
  try {
    logger.info('hello')
    logger.debug(process.env)
  } catch (e) {
    logger.error(e)
  }

  setTimeout(() => {
    runMain()
  }, 1000)
}

runMain()
