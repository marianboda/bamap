'use strict'
var _ = require("lodash")
var fetch = require("node-fetch")
var simplify = require("simplify-js")
var round3 = (d) => Math.round(d*1000)/1000

const latlonToKm = (latlon) => {
  return {
    x: round3(latlon[1] * (111.320 * Math.cos(48 * Math.PI / 180)) - 1253),
    y: round3((90 - latlon[0]) * 110.574 - 4465),
  }
}

var baseApiUrl = "http://overpass-api.de/api/interpreter?data=[out:json];"
function fetchFromApi(id){
  let q = `(rel(${id});>);out;`
  return fetch("http://overpass-api.de/api/interpreter?data=[out:json];" + q)
    .then( (res) => {
      return res.json()
    })
}
function fetchSettlements(){
  // let q = encodeURIComponent('(rel[name=Slovensko];>);out;')
  // let q = encodeURIComponent('area[name="Bratislavský kraj"];(rel(area)[type="multipolygon"];>);out;')
  let q = encodeURIComponent(
      'area[name="Slovensko"]->.a;'
    + '(node(area.a)[place="town"];'
      + 'node(area.a)[place="village"];'
      + 'node(area.a)[place="suburb"];'
      + 'way(area.a)[highway=motorway];>;'
      + 'way(area.a)[highway=trunk];>);'
      + 'out;')

  // let q = encodeURIComponent('area[name="Bratislavský kraj"];(rel(area)["admin_level"="10"];>);out;')
  // return console.log(baseApiUrl + q)
  return fetch(baseApiUrl + q)
    .then( (res) => {
      return res.json()
    }).catch( (res) => console.error(res) )
}
let connectPaths = (a1, a2) => {
  let a1_0 = a1[0]
  let a1_n = a1[a1.length - 1]
  let a2_0 = a2[0]
  let a2_n = a2[a2.length - 1]

  if (a1.length == 0 || a2.length == 0 || a1_n == a2_0) {
    return _.concat(a1, a2)
  } else if (a1_n == a2_n) {
    return _.concat(a1, _.reverse(a2))
  } else if (a1_0 == a2_0) {
    return _.concat(_.reverse(a1), a2)
  } else {
    return _.concat(a2, a1)
  }
}

function getVillages() {
  let q = encodeURIComponent('area[name="Bratislavský kraj"];(node(area)[type="multipolygon"];>);out;')
}

function transformResponse(res){
  let elements = res.elements
  let nodes = elements.filter( i => i.type == "node" )
  let ways = elements.filter( i => i.type == "way" )
  let rels = elements.filter( i => i.type == "relation")
  console.log(`${nodes.length} nodes, ${ways.length} ways, ${rels.length} rels`)

  let villages = elements.filter(i => {
    return (i.tags && i.tags.place
      && ( i.tags.place == 'village' || i.tags.place == 'town' || i.tags.place == 'suburb'))
  }).map(i => {
    return {
      name: i.tags.name,
      population: (i.tags.population) ? i.tags.population : 0,
      place: i.tags.place,
      coords: latlonToKm([i.lat, i.lon]),
    }
  }).filter(i => i.population >=900)
  console.log('villages', villages.length)

  let nodeIdx =  nodes.reduce((acc, el) => {
    acc[el.id] = el
    return acc
  }, {})

  let pointIdx = nodes.reduce((acc, el) => {
    acc[el.id] = latlonToKm([el.lat, el.lon])
    return acc
  }, {})

  let wayIdx = ways.reduce((acc, el) => {
    acc[el.id] = el
    return acc
  }, {})

  let paths = ways.reduce((acc, el) => {
    acc[el.id] = el.nodes.map((i) => pointIdx[i])
    return acc
  }, {})

  let roads = ways.filter(i => i.tags.highway === 'motorway' || i.tags.highway === 'trunk')
    .map(i => { return {points: paths[i.id]}})

  // let settlements = rels.map((i) => {
  //   let borderWayIds = i.members.filter(i => i.type === "way" && i.role === "outer")
  //   let borderNodes = borderWayIds.map((w) => wayIdx[w.ref].nodes).reduce(connectPaths, [])
  //   let border = borderNodes.map(i => pointIdx[i])
  //   let simplifiedBorder = simplify(border, 0.1, true)
  //   let centreMember = i.members.filter(i => i.type === "node" && i.role === "admin_centre")[0]
  //   let centre = (centreMember) ? nodeIdx[centreMember.ref] : null
  //
  //   return {
  //     name: (i && i.tags && i.tags.name) ? i.tags.name : '',
  //     centre: centre,
  //     border: simplifiedBorder,
  //   }
  // })

  return {
    json: res,
    viewBox: [0, 0, 440, 220],
    // viewBox: [0, 120, 60, 60],
    // cities: settlements,
    villages: villages,
    roads: roads,
  }
}

function getData(id){
  console.log('fetching data')
  let d = Promise.defer()
  // var data = require('../ba_kraj.json')
  // d.resolve(transformResponse(data))
  let json = fetchSettlements()
  json.then((res) => {
    d.resolve(transformResponse(res))
  }).catch(err => console.error(err))
  return d.promise
}

module.exports = getData
