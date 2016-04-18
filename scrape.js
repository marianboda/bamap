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

let connectPaths = (a1, a2) => {
  if (a1.length == 0 || a2.length == 0)
    return _.concat(a1, a2)

  let a1_0 = a1[0]
  let a1_n = a1[a1.length - 1]
  let a2_0 = a2[0]
  let a2_n = a2[a2.length - 1]

  if (a1_n == a2_0) {
    return _.concat(a1, a2)
  } else if (a1_n == a2_n) {
    return _.concat(a1, _.reverse(a2))
  } else if (a1_0 == a2_0) {
    return _.concat(_.reverse(a1), a2)
  } else if (a1_0 == a2_n) {
    return _.concat(a2, a1)
  }
  console.log('NOT CONNECTABLE', a1, a2)
  return []
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
  console.log('inserting ' + table + ': ' + records.length + ' values')
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
  let nodes = res.elements.filter( i => i.type == "node" )
  let ways = res.elements.filter( i => i.type == "way" )
  let waysByEnds = ways.reduce((acc, el) => {
    let start = el.nodes[0]
    let end = el.nodes[el.nodes.length-1]
    if (!(start in acc)) acc[start] = []
    acc[start].push(el)
    if (!(end in acc)) acc[end] = []
    acc[end].push(el)
    return acc
  }, {})

  let joinIdx = _.reduce(waysByEnds, (acc, val, key) => {
    if (val.length == 2)
      acc[key] = val
    return acc
  }, {})

  let usedPoints = {}
  let wayGroups = []

  for (let key in joinIdx) {
    if (usedPoints[key]) continue

    let startPoint = key
    let getNeighbors = (start) => {
      let leftWay = joinIdx[start][0]
      let leftPoint = [leftWay.nodes[0], leftWay.nodes[leftWay.nodes.length-1]]
        .filter(i => i != start)[0]
      let rightWay = joinIdx[start][1]
      let rightPoint = [rightWay.nodes[0], rightWay.nodes[rightWay.nodes.length-1]]
        .filter(i => i != start)[0]
      return [leftPoint, rightPoint]
    }

    let waysToMerge = joinIdx[startPoint]
    let addWays = (ways) => {
      ways.forEach(w => {
        if (waysToMerge.indexOf(w) == -1)
          waysToMerge.push(w)
      })
    }

    usedPoints[startPoint] = true
    for (let j = 0; j <= 1; j++) {
      let current = getNeighbors(startPoint)[j]
      while (joinIdx[current] && !usedPoints[current]) {
        usedPoints[current] = true
        addWays(joinIdx[current])
        // console.log(' - ' + current)
        current = getNeighbors(current).filter(i => !usedPoints[i])[0]
      }
    }
    wayGroups.push(waysToMerge)
    // console.log(Object.keys(usedPoints).length)
  }

  let discardedWays = _.flatten(wayGroups).reduce((acc, el) => {
    acc[el.id] = true
    return acc
  }, {})

  let unjoinableWays = ways.filter(i => !discardedWays[i.id]).map(i => i.nodes)
  let newWays = wayGroups.map(g => {
    return g.reduce((acc, el) => {
      return connectPaths(acc, el.nodes)
    }, [])
  })

  let allWays = _.concat(unjoinableWays, newWays)

  let pointIdx = nodes.reduce((acc, el) => {
    acc[el.id] = [el.lat, el.lon]
    return acc
  }, {})

  let allWaysCoord = allWays.map(w => {
    return w.map(p => pointIdx[p])
  })

  return allWaysCoord
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

getRoads().then( data => {
  console.log(data.elements.length)
  let roads = responseToRoads(data)
  insert('road', roads.map(i => {
    return {
      points: JSON.stringify(i),
      svg_path: '',
      type: '',
    }
  })).then(res => {
    knex.destroy()
  })

}).catch((err) => {console.error(err, err.lineNumber); knex.destroy()})
