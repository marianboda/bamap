'use strict'
var koa = require('koa')
var fetch = require("node-fetch")
var _ = require("lodash")
var app = koa()
var simplify = require("simplify-js")

var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"]
var query = '(rel(1702499);>);out;'

function getData(){
  return fetch("http://overpass-api.de/api/interpreter?data=[out:json];" + query)
    .then( (res) => {
      return res.json()
    })
}

app.use(function *(next) {
  var start = new Date
  yield next
  var ms = new Date - start
  this.set('X-Response-Time', ms + ' ms')
})

app.use(function *(next){
  var start = new Date
  yield next
  var ms = new Date - start
  console.log('%s %s - %s', this.method, this.url, ms)
})

app.use(function *(){
  let json = yield getData()
  console.log(Object.keys(json))
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

  let pathData = (m) => {
    return m.reduce((acc, el) => {
      return acc + (acc == "M" ? '' : 'L') + el.x + ' ' + el.y
    }, 'M')
  }

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
  var ratio = Math.abs(Math.cos(48))
  var factor = 0.5
  var scale = [factor, factor * ratio]
  var viewBox = [16.9, 47.9, scale[0], scale[1]]

  this.body = `<svg width="100%" height="100%" viewBox="${viewBox.join(' ')}" preserveAspectRatio="none">`
    + '<g transform="scale(1,-1) translate(0,-96.2)">'
    + '<path fill="orange" stroke="black" stroke-width="0.001" d="' + pathData(simplified) + 'Z"/>'
    + '</g>'
    + '</svg>'
})
app.listen(3000)
