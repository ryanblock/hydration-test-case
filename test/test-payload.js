let checkHydration = require('../src/scheduled/check-hydration').handler

let payload = {hi:'there'}
let context = {}
let callback = () => {
  console.log('finished executing')
  return
}

checkHydration(payload, context, callback)