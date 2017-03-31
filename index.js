'use strict'

const fs = require('fs')
const EventEmitter = require('events')
const inherits = require('util').inherits
const deep = require('deep-access')

const CI = {
  travis: require('travis-watch'),
  appVeyor: require('appveyor-watch')
}

module.exports = Watch
inherits(Watch, EventEmitter)

function Watch (dir) {
  if (!(this instanceof Watch)) return new Watch(dir)
  EventEmitter.call(this)
  this._dir = dir
  this._ci = {}
  this._started = new Date()
}

Watch.prototype.state = function () {
  const one = key => {
    let val
    Object.keys(this._ci).forEach(name => {
      val = val || deep(this._ci[name].state, key)
    })
    return val
  }

  const all = key =>
    Object.keys(this._ci).map(name => deep(this._ci[name].state, key))

  return {
    started: this.started,
    commit: {
      sha: one('commit.sha'),
      found: one('commit.found'),
      branch: one('commit.branch')
    },
    link: all('link').join('\n'),
    repo: one('repo'),
    build: one('build') && {
      number: all('build?.number').filter(Boolean).join('/')
    },
    results: all('results').reduce(
      (acc, results) => {
        Object.keys(results).forEach(os => {
          acc[os] = results[os]
        })
        return acc
      },
      {}
    ),
    success: all('success').reduce(
      (acc, success) => typeof acc === 'boolean' && !acc ? acc : success
    )
  }
}

Watch.prototype._checkEnvironment = function (cb) {
  fs.stat(`${this._dir}/.travis.yml`, noTravis => {
    fs.stat(`${this._dir}/appveyor.yml`, noAppVeyor => {
      cb(null, {
        travis: !noTravis,
        appVeyor: !noAppVeyor
      })
    })
  })
}

Watch.prototype.start = function () {
  this._checkEnvironment((err, ci) => {
    if (err) return this.emit('error', err)
    let todo = Object.keys(ci).length
    const onfinish = () => {
      if (!--todo) this.emit('finish')
    }
    Object.keys(ci).forEach(name => {
      if (!ci[name]) return
      const watch = this._ci[name] = CI[name](this._dir)
      watch.start()
      watch.on('finish', onfinish)
    })
  })
}
