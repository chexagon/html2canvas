var canvg = require('canvg-browser');

function getRootElementFontSize() {
    // Returns a number
    return parseFloat(
        // of the computed font-size, so in px
        getComputedStyle(
            // for the root <html> element
            document.documentElement
        )
        .fontSize
    );
}

// Convert Rem units to px
function rem2px(value) {
  return value * getRootElementFontSize();
}

function cssTextRem2px(cssTxt) {
  var rules = cssTxt.split(';');
  var convert = {};
  rules = rules.map(function (r) {
    if (r.indexOf('rem') !== -1) {
      var rem = r.split(':')[1].trim();
      var px  = parseInt(Math.round(rem2px(parseFloat(rem.replace('rem','')))));
      return r.replace(rem, px+'px');
    }else{
      return r;
    }
  });
  return rules.filter(function(r) { return !!r}).join(';');
}

function svgEmbedCss(svgNode) {
  var bbox = svgNode.getBoundingClientRect();
  svgNode.setAttribute("width", parseInt(Math.round(bbox.width)));
  svgNode.setAttribute("height", parseInt(Math.round(bbox.height)));

  var nodeId = svgNode.id ? '#'+svgNode.id : '.'+svgNode.getAttribute('class').split(' ')[0];
  var rules = {};
  for (var i=0; i<document.styleSheets.length; i++) {
    var sheet = document.styleSheets[i];
    for (var r=0; r<sheet.cssRules.length; r++) {
      var rule = sheet.cssRules[r];
      if (rule.selectorText && rule.selectorText.indexOf(nodeId) !== -1) {
        //console.log('applicable rule', rule.selectorText);
        var selector = rule.selectorText.split(',')
          .filter(function (s){ return s.indexOf(nodeId) !== -1 })
          .map(function (s) {
            s = s.split(nodeId);
            if (s.length == 2 && !!s[1].trim()) {
              var res = s[1].split(' ');
              res.shift();
              return res.join(' ');
            } else {
              return nodeId;
            }
          }).join(', ');
        rules[selector] = cssTextRem2px(rule.style.cssText);
      }
    }
  }
  var cssText = Object.keys(rules).map(function (r) { return r + ' {'+rules[r]+'}';}).join(' ');
  appendStyle2Defs(svgNode, cssText);
}

function fonts2SVGStyle(svgNode) {
  if (!svgNode.querySelector('text')) return;
  var fontFaces = '';
  for (var i=0; i<document.styleSheets.length; i++) {
    var sheet = document.styleSheets[i];
    for (var r=0; r<sheet.cssRules.length; r++) {
      var rule = sheet.cssRules[r];
      if (rule instanceof CSSFontFaceRule) {
        fontFaces += rule.cssText;
      }
    }
  }
  appendStyle2Defs(svgNode, fontFaces);
}

function appendStyle2Defs(svgNode, cssText) {
  var defs = svgNode.querySelector('defs');
  if (!defs) {
    var defs = document.createElement('defs');
    svgNode.insertBefore(defs, svgNode.firstChild);
  }
  var style = document.createElement('style');
  style.setAttribute('type', 'text/css');
  style.textContent = cssText;
  defs.appendChild(style);
}

function extractSVGSize(svgString) {

  var w = svgString.match(/<svg[^>]*width\s*=\s*\"?(\d+)\"?[^>]*>/);
  var h = svgString.match(/<svg[^>]*height\s*=\s*\"?(\d+)\"?[^>]*>/);
  var viewBox = svgString.match(/<svg[^>]*viewbox\s*=\s*\"?(\d+ \d+ \d+ \d+)\"?[^>]*>/);

  if (!w.length > 1 && viewBox.length > 1) {
    w = parseInt(viewBox[1].split(' ')[3]);
    h = parseInt(viewBox[1].split(' ')[4]);
  }else{
    w = parseInt(w[1]);
    h = parseInt(h[1]);
  }

  return {w : w, h : h};
}

function canvg2Png(svgCode, scale) {
  return new Promise(function(resolve, reject) {
    var canvas = document.createElement('canvas');
    var svgSize = extractSVGSize(svgCode);
    canvas.style.position = 'absolute';
    canvas.style.top = '-10000px';
    canvas.width = svgSize.w * scale;
    canvas.height = svgSize.h * scale;
    document.body.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    canvg(canvas, svgCode, {
      ignoreMouse : true,
      ignoreAnimation : true,
      ignoreDimensions : true,
      scaleWidth : svgSize.w,
      scaleHeight : svgSize.h,
      renderCallback : function () {
        ctx.webkitImageSmoothingEnabled = false;
        ctx.mozImageSmoothingEnabled = false;
        ctx.imageSmoothingEnabled = false;
        var imgCode = canvas.toDataURL("image/png",1);
        document.body.removeChild(canvas);
        resolve(imgCode);
      }
    });
  });
}

module.exports = {
  fonts2SVGStyle : fonts2SVGStyle,
  svgEmbedCss    : svgEmbedCss,
  canvg2Png      : canvg2Png
}
