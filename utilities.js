var round3 = (d) => Math.round(d*1000)/1000

module.exports.latlonToKm = function latlonToKm(latlon) {
  return {
    x: round3(latlon[1] * (111.320 * Math.cos(48 * Math.PI / 180)) - 1253),
    y: round3((90 - latlon[0]) * 110.574 - 4465),
  }
}
