'use strict'
var _ = require("lodash")
var fetch = require("node-fetch")
var simplify = require("simplify-js")

var query = '(rel(14296);>);out;'

function fetchFromApi(){
  return fetch("http://overpass-api.de/api/interpreter?data=[out:json];" + query)
    .then( (res) => {
      return res.json()
    })
}

function *getData(){
  let json = yield fetchFromApi()
  let elements = json.elements
  console.log (`${elements.length} elements`)
  let nodes = elements.filter( i => i.type == "node" )
  let ways = elements.filter( i => i.type == "way" )
  let rels = elements.filter( i => i.type == "relation")

  let nodeIdx = nodes.reduce((acc, el) => {
    acc[el.id] = [el.lon, el.lat]
    return acc
  }, {})
  let wayIdx = ways.reduce((acc, el) => {
    acc[el.id] = el
    return acc
  }, {})

  let paths = ways.reduce((acc, el) => {
    acc[el.id] = el.nodes.map((i) => nodeIdx[i])
    return acc
  }, {})

  let areaWays = rels[0].members.filter(i => i.type === "way" && i.role === "outer").map(i => i.ref)
  let connect = (a1, a2) => {
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

  let areaPoints = areaWays.map((i) => wayIdx[i].nodes)
    .reduce(connect,[])

  let coordPoints = areaPoints.map(i => { return {x: nodeIdx[i][0], y: nodeIdx[i][1]}})
  let simplified = simplify(coordPoints, 0.0005, true)
  console.log(simplified.length)
  var ratio = Math.abs(Math.cos(48))
  var factor = 4
  var scale = [factor, factor * ratio]
  var viewBox = [16.9, 49.3, scale[0], scale[1]]

  return {
    viewBox: viewBox,
    cities: [
      simplified
    ]
  }
}

module.exports = getData
