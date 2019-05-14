const express = require('express')
const bodyParser = require('body-parser')
const session = require('express-session')
const axios = require('axios')

const optimizely = require('@optimizely/optimizely-sdk')
const defaultEventDispatcher = require('@optimizely/optimizely-sdk').eventDispatcher
const defaultLogger = require('@optimizely/optimizely-sdk').logging
const optimizelyEnums = require('@optimizely/optimizely-sdk').enums

// OPTIMIZELY
let optimizelyClientInstance = null
let dataFile = null
let userStorage = {}

const userProfileService = {
  lookup: userId => {
    if (userStorage.hasOwnProperty(userId)) return userStorage[userId]
    else return null
  },
  save: userProfileMap => {
    const { user_id, experiment_bucket_map } = userProfileMap
    userStorage[user_id] = experiment_bucket_map
  },
}

const customErrorHandler = {
  handleError: (exception) => {
    console.error('Caught Optimizely Error')
    console.error(exception)
  },
}

const eventDispatcherMiddleware = {
  dispatchEvent: (eventObj, callback) => {
    console.log('Sending data to optimizely. URL:', eventObj.httpVerb, eventObj.url)
    defaultEventDispatcher.dispatchEvent(eventObj, callback)
  },
}

function onDecision (decisionObject) {
  console.log('Oh, its a decision for', decisionObject.type)
}

// Get data file
const initOptimizely = async () => {
  const result = await axios.get(
    'https://cdn.optimizely.com/datafiles/C31EvBBW1SPigwRNwkDe88.json')

  if (!result.data) throw new Error('Could not fetch data file')

  if (!dataFile || JSON.stringify(result.data) !== JSON.stringify(dataFile)) {
    console.log('Creating new client')
    optimizelyClientInstance = optimizely.createInstance(
      {
        datafile: result.data,
        userProfileService,
        eventDispatcher: eventDispatcherMiddleware,
        logger: defaultLogger.createLogger({
          logLevel: optimizelyEnums.LOG_LEVEL.ERROR,
        }),
        errorHandler: customErrorHandler,
      })
    optimizelyClientInstance.notificationCenter.addNotificationListener(
      optimizelyEnums.NOTIFICATION_TYPES.DECISION,
      onDecision,
    )
    dataFile = result.data
  }
}

initOptimizely()
setInterval(initOptimizely, 30000)

// EXPRESS

const app = express()

app.use(bodyParser.json())
app.use(session({
  secret: 'keyboard cat',
  saveUninitialized: true,
  resave: false,
  cookie: { maxAge: 60000000 },
}))

app.use((req, res, next) => {
  if (!req.body.gender) {
    let gender = Math.random() > 0.5 ? 'f' : 'm'
    console.log('Generated Random Gender', gender)
    req.body.gender = gender
  }

  if (!req.body.userID) {
    if (req.session.userID) {
      console.log('Using user from session: ', req.session.userID)
      req.body.userID = req.session.userID
    } else {
      let uID = String(Math.random()).substr(2)
      console.log('Generated Random Gender', uID)
      req.body.userID = uID
    }
  }

  next()
})

app.get('/', (req, res) => {
  res.send(req.session.userID ? `Hello ${req.session.userID}!` : 'Hi!')
})

app.get('/ab', (req, res) => {
  if (req.body.userID === 'var1') {
    console.log('Forcing variation_1')
    optimizelyClientInstance.setForcedVariation(
      'ab_test',
      'var1',
      'variation_1',
    )
  }

  if (req.body.userID === 'var2') {
    console.log('Forcing variation_2')
    optimizelyClientInstance.setForcedVariation(
      'ab_test',
      'var2',
      'variation_2',
    )
  }

  const variation = optimizelyClientInstance.activate('ab_test',
    req.body.userID, {
      gender: req.body.gender,
    })

  if (variation === 'variation_1') {
    res.send('variation_1')
  } else if (variation === 'variation_2') {
    res.send('variation_2')
  } else {
    res.send('default')
  }
  optimizelyClientInstance.track('pageview', req.body.userID, {
    gender: req.body.gender,
  })
})

app.get('/feature', (req, res) => {
  const enabled = optimizelyClientInstance.isFeatureEnabled('feature',
    req.body.userID, {
      gender: req.body.gender,
    })
  const var_key = optimizelyClientInstance.getFeatureVariableString('feature',
    'var_key', req.body.userID, {
      gender: req.body.gender,
    })
  if (enabled) {
    res.send(var_key)
  } else {
    res.send('default')
  }
  optimizelyClientInstance.track('pageview', req.body.userID, {
    gender: req.body.gender,
  })
})

app.get('/rollout', (req, res) => {
  const enabled = optimizelyClientInstance.isFeatureEnabled('rollout',
    req.body.userID, {
      gender: req.body.gender,
    })
  const rollout_variable = optimizelyClientInstance.getFeatureVariableString(
    'rollout', 'rollout_variable', req.body.userID, {
      gender: req.body.gender,
    })
  if (enabled) {
    res.send(rollout_variable)
  } else {
    res.send('default')
  }
  optimizelyClientInstance.track('pageview', req.body.userID, {
    gender: req.body.gender,
  })
})

app.post('/set/user', (req, res) => {
  req.session.userID = req.body.userID
  res.sendStatus(200)
})

app.listen(3000, function () {
  console.log('Example app listening on port 3000!')
})

