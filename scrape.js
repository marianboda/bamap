'use strict'
var sql = require("sqlite3")
var async = require("async")
var knex = require('knex')({
  client: 'sqlite3',
  connection: {filename: './map.db'},
  useNullAsDefault: true,
})
var fetch = require("node-fetch")
var _ = require("lodash")

var baseApiUrl = "http://overpass-api.de/api/interpreter?data=[out:json];"
function fetchFromApi(q) {
  return fetch("http://overpass-api.de/api/interpreter?data=[out:json];" + q)
    .then(res => res.json())
}

let q = encodeURIComponent(
    'area[name="Slovensko"]->.a;'
  + 'node(area.a)[place~"city|town|village|suburb"];'
  + 'out;')

    // + 'way(area.a)[highway=motorway];>;'
    // + 'way(area.a)[highway=trunk];>);'

let insert = (table, records) => {
  let d = Promise.defer()
  knex.batchInsert(table, records, 100).then(d.resolve).catch(d.reject)
  return d.promise
}

let responseToSettlements = (res) => {
  return res.elements.map(i => {
    return {
      name: i.tags.name,
      population: (i.tags.population) ? i.tags.population : 0,
      type: i.tags.place,
      lat: i.lat,
      lon: i.lon,
      data: JSON.stringify(i),
    }
  })
}

let scrapeSettlements = () => {
  let d = Promise.defer()
  fetchFromApi(q).then((res) => {
    console.log(res.elements.length, ' elements')
    insert('settlement', responseToSettlements(res))
      .then(res => { console.log('inserted'); d.resolve(res) })
      .catch(e => { console.error(e); d.reject(e) })
  }).catch(e => { console.error(e); d.reject(e) })
  return d.promise
}

scrapeSettlements().then( (res) => { console.log('done :)'); process.exit() })
  .catch(console.error)


// async.series([
//
// ])
