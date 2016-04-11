var bowser = require('bowser');
var chUtils = require('./chUtils');
/*if (cssBgImage.indexOf('svg+xml') !== -1){
  var src = cssBgImage.args[0].split(',');
  var svgCode = src[1];
  if (src[0].indexOf('base64') !== -1) {
    svgCode = atob(svgCode);
  }
  svgCode = decodeURIComponent(unescape(svgCode));

}*/

function ImageContainer(src, cors, options) {
    this.src = src;
    this.image = new Image();
    var self = this;
    this.tainted = null;
    this.promise = new Promise(function(resolve, reject) {
        if (bowser.msie && self.src.indexOf('data:image/svg+xml') !== -1){
          var uri = self.src.split(',');
          var svgCode = uri[1];
          if (uri[0].indexOf('base64') !== -1) {
            svgCode = atob(svgCode);
          }
          svgCode = decodeURIComponent(unescape(svgCode));
          chUtils.canvg2Png(svgCode, options.scale)
          .then(function (pngUri) {
            self.image.onload = resolve;
            self.image.onerror = reject;
            if (cors) {
              self.image.crossOrigin = "anonymous";
            }
            self.image.src = pngUri;
            if (self.image.complete === true) {
              resolve(self.image);
            }
          }, function (err) {
            reject(err);
          })

        }else {
          self.image.onload = resolve;
          self.image.onerror = reject;
          if (cors) {
              self.image.crossOrigin = "anonymous";
          }
          self.image.src = src;
          if (self.image.complete === true) {
              resolve(self.image);
          }
        }
    });
}

module.exports = ImageContainer;
