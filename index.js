'use strict'
var koa = require('koa')
var serve = require('koa-static')
var router = require('koa-router')()
var _ = require("lodash")
var app = koa()

var getData = require("./src/fetchData")

var CSS_COLOR_NAMES = ["AliceBlue","AntiqueWhite","Aqua","Aquamarine","Azure","Beige","Bisque","Black","BlanchedAlmond","Blue","BlueViolet","Brown","BurlyWood","CadetBlue","Chartreuse","Chocolate","Coral","CornflowerBlue","Cornsilk","Crimson","Cyan","DarkBlue","DarkCyan","DarkGoldenRod","DarkGray","DarkGrey","DarkGreen","DarkKhaki","DarkMagenta","DarkOliveGreen","Darkorange","DarkOrchid","DarkRed","DarkSalmon","DarkSeaGreen","DarkSlateBlue","DarkSlateGray","DarkSlateGrey","DarkTurquoise","DarkViolet","DeepPink","DeepSkyBlue","DimGray","DimGrey","DodgerBlue","FireBrick","FloralWhite","ForestGreen","Fuchsia","Gainsboro","GhostWhite","Gold","GoldenRod","Gray","Grey","Green","GreenYellow","HoneyDew","HotPink","IndianRed","Indigo","Ivory","Khaki","Lavender","LavenderBlush","LawnGreen","LemonChiffon","LightBlue","LightCoral","LightCyan","LightGoldenRodYellow","LightGray","LightGrey","LightGreen","LightPink","LightSalmon","LightSeaGreen","LightSkyBlue","LightSlateGray","LightSlateGrey","LightSteelBlue","LightYellow","Lime","LimeGreen","Linen","Magenta","Maroon","MediumAquaMarine","MediumBlue","MediumOrchid","MediumPurple","MediumSeaGreen","MediumSlateBlue","MediumSpringGreen","MediumTurquoise","MediumVioletRed","MidnightBlue","MintCream","MistyRose","Moccasin","NavajoWhite","Navy","OldLace","Olive","OliveDrab","Orange","OrangeRed","Orchid","PaleGoldenRod","PaleGreen","PaleTurquoise","PaleVioletRed","PapayaWhip","PeachPuff","Peru","Pink","Plum","PowderBlue","Purple","Red","RosyBrown","RoyalBlue","SaddleBrown","Salmon","SandyBrown","SeaGreen","SeaShell","Sienna","Silver","SkyBlue","SlateBlue","SlateGray","SlateGrey","Snow","SpringGreen","SteelBlue","Tan","Teal","Thistle","Tomato","Turquoise","Violet","Wheat","White","WhiteSmoke","Yellow","YellowGreen"]

app.use(serve(__dirname + '/static'))

const pathData = (m) => {
  return m.reduce((acc, el) => {
    return acc + (acc == "M" ? '' : 'L') + el.x + ' ' + el.y
  }, 'M')
}

router.get('/', function *(next){
  console.log(this.request.url)
  if (this.request.url == '/favicon.ico') { return }

  var get = require("./src/OSMService")
  var country = require('./slovakia')
  var data = yield get(14296)

  this.body = `<div style="float: left; overflow: hidden; border: 1px solid #ccc;"><svg width="800" height="800" viewBox="${data.viewBox.join(' ')}">`
    // + '<g>'
    // + data.cities.map(i => {
    //     return '<path fill="orange" stroke="black" stroke-width="0.1" d="' + pathData(i.border) + 'Z"/>'
    //   }).join()
    // + '</g>'
    + '<g><image x="-48" y="-26" width="523" height="258" xlink:href="relief.png" preserveAspectRatio="none"></image></g>'
    + country.border
    + '<g>'
    + data.villages.map(i => {
        let color = '#555555'
        switch (i.place) {
          case "suburb": color = "#FF6600"; break;
          case "town": color = CSS_COLOR_NAMES[2]; break;
        }
        return `<circle r="${0.2 + Math.min(i.population/15000, 2)}"`
          + ` fill="${color}" class="${i.place}" `
          + `cx="${i.coords.x}" cy="${i.coords.y}" />`
      }).join()
    + '</g>'
    + '<g>'
    + data.roads.map(i => {
        return '<path fill="none" stroke="black" stroke-width="0.1" d="' + pathData(i.points) + '"/>'
      }).join()
    + '</g>'
    + '</svg></div>'
    + '<br><table>'
    + data.villages.sort((a,b) => {
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
