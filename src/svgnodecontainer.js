var SVGContainer = require('./svgcontainer');
var canvg = require('canvg-browser');
var bowser = require('bowser');

function SVGNodeContainer(node, _native, options) {
    this.src = node;
    this.image = null;
    var self = this;

    console.log('NATIVE', _native);

    this.promise = _native ? new Promise(function(resolve, reject) {
        self.image = new Image();
        self.image.onload = resolve;
        self.image.onerror = reject;
        // here we go
        if (bowser.msie) {
            // add a canvas somewhere
            var canvas = document.createElement('canvas');
            var svgW = parseInt(node.getBBox().width);
            var svgH = parseInt(node.getBBox().height);
            canvas.style.position = 'absolute';
            canvas.style.top = '-3000px';
            canvas.width = svgW * options.scale;
            canvas.height = svgH * options.scale;
            document.body.appendChild(canvas);
            var ctx = canvas.getContext('2d');
            ctx.scale(options.scale, options.scale);
            var svgCode = (new XMLSerializer()).serializeToString(node);
            canvg(canvas, svgCode, {
      				ignoreMouse : true,
      				ignoreAnimation : true,
      				ignoreDimensions : true,
      				scaleWidth : svgW,
      				scaleHeight : svgH,
      				renderCallback : function () {
                ctx.webkitImageSmoothingEnabled = false;
        				ctx.mozImageSmoothingEnabled = false;
        				ctx.imageSmoothingEnabled = false;
        				var imgCode = canvas.toDataURL("image/png",1);
                document.body.removeChild(canvas);
                self.image.src = imgCode;
                if (self.image.complete === true) {
                  resolve(self.image);
                }
              }
      			});
        }else{
          self.image.src = "data:image/svg+xml;base64," + btoa((new XMLSerializer()).serializeToString(node));
          if (self.image.complete === true) {
            resolve(self.image);
          }
        }
    }) : this.hasFabric().then(function() {
        return new Promise(function(resolve) {
            window.html2canvas.svg.fabric.parseSVGDocument(node, self.createCanvas.call(self, resolve));
        });
    });
}

SVGNodeContainer.prototype = Object.create(SVGContainer.prototype);

module.exports = SVGNodeContainer;
