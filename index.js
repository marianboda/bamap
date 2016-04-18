'use strict'
var koa = require('koa')
var serve = require('koa-static')
var router = require('koa-router')()
var _ = require("lodash")
var app = koa()
var sqlite = require("sqlite3")
var db = new sqlite.Database('./map.db')
var utils = require("./utilities")
var simplify = require("simplify-js")

var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"]

app.use(serve(__dirname + '/static'))

const pathData = (m) => {
  return m.reduce((acc, el) => {
    // if (el === undefined) return acc
    return acc + (acc == "M" ? '' : 'L') + el.x + ' ' + el.y
  }, 'M')
}

function getData(){
  let d = Promise.defer()

  db.all('SELECT * FROM road', (err, data) => {
    let allpoints = 0
    let simplifiedPoints = 0
    let roads = data.map(i => {
      let points = _.map(JSON.parse(i.points), utils.latlonToKm)
      let simplified = simplify(points, 0.1, true)
      allpoints += points.length
      simplifiedPoints += simplified.length
      return {points: simplified, type: i.type}
    })
    console.log(allpoints + ' -> ' + simplifiedPoints)
    db.all('SELECT * FROM settlement', (err, data) => {
      if (err) console.log(err)
      let settlements = data
      d.resolve({settlements, roads})
    })
  })

  return d.promise
}

router.get('/', function *(next){
  console.log(this.request.url)
  if (this.request.url == '/favicon.ico') { return }

  var get = require("./src/OSMService")
  var country = require('./slovakia')

  let data = yield getData()

  console.log(data.roads[0])

  let roads = {
    primary: data.roads.filter(i => i.type == "primary"),
    secondary: data.roads.filter(i => i.type == "secondary"),
    motorway: data.roads.filter(i => i.type == "motorway"),
  }

  console.log(roads.motorway.length)

  data.viewBox = [10, 135, 45, 45]

  this.body = `<div style="float: left; overflow: hidden; border: 1px solid #ccc;">`
    + `<svg width="800" height="800" viewBox="${data.viewBox.join(' ')}">`
    + '<defs>'
      + '<clipPath id="borderline">'
        + `<path fill="black" stroke="none" d="${country.border}"></path>`
      + '</clipPath>'
      + '<clipPath id="cut-off-bottom">'
        + '<rect x="0" y="0" width="200" height="100" />'
      + '</clipPath>'
    + '</defs>'
    + '<g clip-path="url(#borderline)"><image x="-48" y="-26" width="523" height="258" xlink:href="relief.jpg" preserveAspectRatio="none"></image></g>'
    + `<g><path stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="black" stroke-width="1" d="${country.border}"></path></g>`
    + '<g>'
      + roads.secondary.map(i => {
          return '<path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="' + "#333333" + '" stroke-width="2" d="' + pathData(i.points) + '"/>'
        }).join()
    + '</g>'
    + '<g>'
      + roads.primary.map(i => {
          return '<path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="' + "#66FF88" + '" stroke-width="4" d="' + pathData(i.points) + '"/>'
        }).join()
    + '</g>'
    + '<g>'
      + roads.primary.map(i => {
          return '<path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="' + "#333333" + '" stroke-width="2" d="' + pathData(i.points) + '"/>'
        }).join()
    + '</g>'
    + '<g>'
      + roads.motorway.map(i => {
          return '<path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="' + "#FF8800" + '" stroke-width="5" d="' + pathData(i.points) + '"/>'
        }).join()
    + '</g>'
    + '<g>'
      + roads.motorway.map(i => {
          return '<path vector-effect="non-scaling-stroke" stroke-linecap="round" stroke-linejoin="round" fill="none" stroke="' + "#333333" + '" stroke-width="3" d="' + pathData(i.points) + '"/>'
        }).join()
    + '</g>'
    + '<g>'
      + data.settlements.map(i => {
          let color = '#222222'
          switch (i.place) {
            case "suburb": color = "#FF6600"; break;
            case "town": color = "#002255"; break;
          }
          let coords = utils.latlonToKm([i.lat, i.lon])
          return `<circle r="${0.2 + Math.min(i.population/20000, 1.3)}"`
            + ` fill="${color}" class="${i.place}" `
            + `cx="${coords.x}" cy="${coords.y}" />`
        }).join()
    + '</g>'
    + '<g>'
      + data.settlements.map(i => {
          let color = "#6699FF"
          let coords = utils.latlonToKm([i.lat, i.lon])
          return `<circle r="${0.2 + Math.min(i.population/20000, 1.3) - 0.1}"`
            + ` fill="${color}" class="${i.place}" `
            + `cx="${coords.x}" cy="${coords.y}" />`
        }).join()
    + '</g>'
    + '</svg></div>'
    + '<br><table>'
      + data.settlements.sort((a,b) => {
          return 0 - (a.population - b.population)
        }).map((i,idx) => {
          return '<tr>'
            + `<td>${idx+1}</td>`
            + `<td>${i.name}</td>`
            + `<td>${i.population}</td>`
        }).join('')
      + '</table>'
})
app.use(router.routes())
  .use(router.allowedMethods())
app.listen(3000)
