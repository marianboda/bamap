'use strict'
var sql = require("sqlite3")
var async = require("async")
var fs = require("fs")
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
    .then(res => {
      return res.json()
    })
}

let q = encodeURIComponent(
    'area[name="Slovensko"]->.a;'
  + 'node(area.a)[place~"city|town|village|suburb"];'
  + 'out;')

let roadQ = encodeURIComponent(
  'area[name="Slovensko"]->.a;'
  + '(way(area.a)[highway~"motorway|trunk|primary|secondary"];>);out;' //|tertiary|unclassified
)

let roadsFilename = './roads.json'

function getRoads(){
  let d = Promise.defer()
  fs.readFile(roadsFilename, (err, data) => {
    if (err) {
      console.log('error reading file.. going to fetch from OSM API')
      fetchFromApi(roadQ).then((res) => {
        fs.writeFile(roadsFilename, JSON.stringify(res), (err) => {
          console.log('file written')
          d.resolve(res)
        })
      })
    }
    else {
      console.log('file read alright')
      d.resolve(JSON.parse(data))
    }
  })
  return d.promise
}

function insert(table, records){
  console.log('inserting ' + table + ' ' + records.length + 'values')
  let d = Promise.defer()
  knex.batchInsert(table, records, 100).then(r => d.resolve(r)).catch(e => d.reject(e))
  return d.promise
}

function responseToSettlements(res){
  return res.elements.map(i => {
    return {
      osm_id: i.id,
      name: i.tags.name,
      population: (i.tags.population) ? i.tags.population : 0,
      type: i.tags.place,
      lat: i.lat,
      lon: i.lon,
      data: JSON.stringify(i),
    }
  })
}

function responseToRoads(res){
  console.log(Object.keys(res))
  let nodes = res.elements.filter( i => i.type == "node" )
  let ways = res.elements.filter( i => i.type == "way" )

  console.log(ways[0])

  let waysByEnds = ways.map(i => {
    return {
      nodes: i.nodes,
    }
  })
  .reduce((acc, el) => {
    let start = el.nodes[0]
    let end = el.nodes[el.nodes.length-1]
    if (!(start in acc)) acc[start] = []
    acc[start].push(el)
    if (!(end in acc)) acc[end] = []
    acc[end].push(el)
    return acc
  }, {})

  let acc = {}
  for (var key in waysByEnds) {
    if (!(waysByEnds[key].length in acc)) acc[waysByEnds[key].length] = 0
    acc[waysByEnds[key].length] += 1;
  }
  //
  // let joined = ways.reduce((acc, el) => {
  //
  //   //acc.push()
  // }, {})

  let sample = _.take(ways, 10)

  sample.forEach(i => console.log(i.id))
  console.log('==========')


  console.log(acc)

  console.log(`${nodes.length} nodes, ${ways.length} ways`)
  let nodeIdx =  nodes.reduce((acc, el) => {
    // let o = {}; o[el.id] = el
    // return Object.assign(o, acc)
    acc[el.id] = el
    return acc
  }, {})

  // ways.
  console.log('end of transform')
  return []

  // let pointIdx = nodes.reduce((acc, el) => {
  //   let o = {}; [el.id] = latlonToKm([el.lat, el.lon])
  //   return Object.assign(o, acc)
  // }, {})
  // let paths = ways.reduce((acc, el) => {
  //   acc[el.id] = el.nodes.map((i) => pointIdx[i])
  //   return acc
  // }, {})

  // return res.elements.map(i => {
  //   return {
  //     osm_id: i.id,
  //     name: i.tags.name,
  //     population: (i.tags.population) ? i.tags.population : 0,
  //     type: i.tags.place,
  //     lat: i.lat,
  //     lon: i.lon,
  //     data: JSON.stringify(i),
  //   }
  // })
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

let scrape = (query, type, mapF) => {
  let d = Promise.defer()
  getRoads.then((res) => {
    console.log(res.elements.length, ' elements')
    insert(type, mapF(res))
      .then(res => { console.log('inserted'); d.resolve(res) })
      .catch(e => { console.error(e); d.reject(e) })
  }).catch(e => { console.error(e); d.reject(e) })
  return d.promise
}

// scrapeSettlements().then( (res) => {
//   console.log('settlements done :)')
// }).catch(console.error)

// scrape(roadQ, 'road', responseToRoads).then( (res) => {
//   console.log('roads done :)')
//   // console.log(process._getActiveRequests())
//   // console.log('--')
//   // console.log(process._getActiveHandles())
//   // process.exit()
// }).catch(console.error)

getRoads().then( data => {
  console.log(data.elements.length)
  responseToRoads(data)
  knex.destroy()
}).catch((err) => {console.error(err); knex.destroy()})

// async.series([
//
// ])
