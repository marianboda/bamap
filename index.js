'use strict'
var fetch = require("node-fetch")

fetch("http://overpass-api.de/api/interpreter?data=[out:json];relation%5B%22name%22%3D%22Bratislava%22%5D%3B%3E%3Bout%20body%3B%0A")
  .then( res => res.text() )
  .then( (res) => {

    //console.log (res)
    let o = JSON.parse(res)
    console.log(Object.keys(o))
    console.log(o.elements.length)
  })
