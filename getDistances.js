'use strict'
var sql = require("sqlite3")

var fetch = require("node-fetch")
var _ = require("lodash")
var Q = require("q")
var sqlite = require("sqlite3")
var db = new sqlite.Database('./map.db')

let buildQuery = (start, end) => {
  return 'http://router.project-osrm.org/viaroute?'
    + `loc=${start.join(',')}&loc=${end.join(',')}`
    + '&geometry=false&alt=false'
}

let dbAll = Q.nfbind(db.all.bind(db))

function getCoords(settlement) {
  console.log([settlement.lat, settlement.lon])
  return [settlement.lat, settlement.lon]
}


let pro = dbAll('SELECT * FROM settlement')
  .then((a) => {
    let settlements = a.filter(i => {
      let isinStr = JSON.parse(i.data).tags.is_in
      return isinStr && isinStr.split(',').indexOf('Bratislavský kraj') > -1
    })
    console.log(settlements.length)
    let bratislava = settlements.filter(i => i.name == "Bratislava")[0]
    return getRoute(getCoords(settlements[0]),getCoords(bratislava)).then((res) => {
      return res.json()
    })
  })
  .then(res => {
    let route = {
      distance: res.route_summary.total_distance,
      time: res.route_summary.total_time,
    }
    return route
  })
  .then(console.log)
  .catch(console.error)

let getRoute = (start, end) => {
  return fetch(buildQuery(start,end))
}
