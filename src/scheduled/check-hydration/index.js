let fs = require('fs')
let path = require('path')
let join = path.join
let cpr = require('cpr')
let rm = require('rimraf')
let series = require('run-series')
let hydrate = require('@architect/hydrate')

exports.handler = function checkHydration(payload, context, callback) {
  let now = `${Date.now()}`
  let tmp = join(path.sep, 'tmp', now)

  series([
    // Make the new working folder
    callback => {
      fs.mkdirSync(tmp)
      if (fs.existsSync(tmp)) {
        console.log('Temp dir exists:', tmp)
        callback()
      }
      else callback(Error('Could not create temporary folder'))
    },
    // Copy mock into the tmp folder
    callback => {
      cpr(join(__dirname, 'mock'), tmp, (err, files) => {
        if (err) callback(err)
        else {
          console.log('Copied over le files:')
          console.log(JSON.stringify(files,null,2))
          callback()
        }
      })
    },
    // Run install
    callback => {
      console.log('Running hydrate.install...')
      let basepath = tmp
      // let env = {NODE_ENV: 'production'} // Not sure why env isn't working, will have to go fix later
      let quiet = true
      let shell = true
      let timeout = 1000*60
      hydrate.install({basepath, /*env,*/ quiet, shell, timeout}, (err, results) => {
        if (err) callback(err)
        else {
          console.log('Hydration results:', JSON.stringify(results[0].raw,null,2))
          callback()
        }
      })
    },
    // Run hydrate
    callback => {
      console.log('About to run hydrate.shared...')
      let cwd = process.cwd()
      process.chdir(tmp)
      console.log('Switching process to work from', tmp)
      hydrate.shared(err => {
        if (err) callback(err)
        else {
          console.log('Switching process back to', cwd)
          process.chdir(cwd)
          callback()
        }
      })
    },
    // Inspect hydrated contents
    callback => {
      let tree = (dir, filelist) => {
        let files = fs.readdirSync(dir)
        filelist = filelist || []
        files.forEach(file => {
          if (fs.statSync(join(dir, file)).isDirectory()) {
            filelist = tree(join(dir, file, path.sep), filelist)
          }
          else {
            filelist.push(join(dir, file))
          }
        })
        return filelist
      }
      let files = tree(tmp)
      console.log('Final file list:', JSON.stringify(files, null, 2))
      callback()
    },
    // REALLY inspect hydrated contents
    callback => {
      let expectedFiles = [
        join(tmp, 'src', 'http', 'get-index', 'node_modules', '@architect', 'shared', '.arc'),
        join(tmp, 'src', 'http', 'get-index', 'node_modules', '@architect', 'shared', 'a-shared-json-file.json'),
        join(tmp, 'src', 'http', 'get-index', 'node_modules', '@architect', 'shared', 'hi-from-shared.js'),
        join(tmp, 'src', 'http', 'get-index', 'node_modules', '@architect', 'views', 'a-views-mjs-file.mjs'),
        join(tmp, 'src', 'http', 'get-index', 'node_modules', '@architect', 'views', 'hi-from-views.js'),
        join(tmp, 'src', 'http', 'get-regular', 'node_modules', '@architect', 'shared', '.arc'),
        join(tmp, 'src', 'http', 'get-regular', 'node_modules', '@architect', 'shared', 'a-shared-json-file.json'),
        join(tmp, 'src', 'http', 'get-regular', 'node_modules', '@architect', 'shared', 'hi-from-shared.js'),
        join(tmp, 'src', 'http', 'get-regular', 'node_modules', '@architect', 'views', 'a-views-mjs-file.mjs'),
        join(tmp, 'src', 'http', 'get-regular', 'node_modules', '@architect', 'views', 'hi-from-views.js'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', '@architect', 'shared', '.arc'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', '@architect', 'shared', 'a-shared-json-file.json'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', '@architect', 'shared', 'hi-from-shared.js'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', '@architect', 'views', 'a-views-mjs-file.mjs'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', '@architect', 'views', 'hi-from-views.js'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', 'tiny-json-http', 'bundle.js'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', 'tiny-json-http', 'package.json'),
        join(tmp, 'src', 'http', 'get-extra-000fancy', 'node_modules', 'tiny-json-http', 'readme.md')
      ]
      series(expectedFiles.map(file => {
        return callback => {
          let fileContents = fs.readFileSync(file).toString()
          if (!fileContents.length) {
            callback(Error('File missing contents', file))
          }
          else callback()
        }
      }), err => {
        if (err) callback(err)
        else {
          console.log(`All ${expectedFiles.length} expected files are hydrated and accounted for`)
          callback()
        }
      })
    },
    callback => {
      // Local teardown
      if (!process.env.NODE_ENV || process.env.NODE_ENV === 'testing') {
        console.log('Running local teardown')
        rm(tmp, err => {
          if (err) callback(err)
          else {
            if (fs.existsSync(tmp)) {
              callback(Error('Temp dir not removed'))
            }
            else {
              console.log('Temp dir (and contents) removed')
              callback()
            }
          }
        })
      }
      else callback()
    },
  ], (err) => {
    if (err) {
      console.log('An error occurred:', err)
      callback(err)
    }
    else callback()
  })
}
