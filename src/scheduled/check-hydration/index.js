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
  let isLocal = !process.env.NODE_ENV || process.env.NODE_ENV === 'testing'

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
    // Run hydrate.install
    callback => {
      console.log('Running hydrate.install...')
      let basepath = tmp
      let env
      if (isLocal) {
        env = {
          PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin',
          NODE_PATH: '/usr/local/lib/node_modules',
          HOME: '/tmp'
        }
      }
      else {
        env = {
          LD_LIBRARY_PATH: '/var/lang/lib:/lib64:/usr/lib64:/var/runtime:/var/runtime/lib:/var/task:/var/task/lib:/opt/lib',
          PATH: '/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin',
          PWD: '/var/task',
          LANG: 'en_US.UTF-8',
          NODE_PATH: '/opt/nodejs/node10/node_modules:/opt/nodejs/node_modules:/var/runtime/node_modules',
          NODE_ENV: 'staging',
          FORCE_COLOR: '3',
          SHLVL: '0',
          ARC_APP_NAME: 'begin',
          CI: 'true',
          HOME: '/tmp'
        }
      }
      let quiet = true
      let shell = true
      let timeout = 1000*60
      hydrate.install({basepath, env, quiet, shell, timeout}, (err, results) => {
        console.log('Hydration results:', JSON.stringify(results[0].raw,null,2))
        if (err) callback(err)
        else {
          callback()
        }
      })
    },
    // Run hydrate.shared
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
      if (isLocal) {
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
