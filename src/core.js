var Support = require('./support');
var CanvasRenderer = require('./renderers/canvas');
var ImageLoader = require('./imageloader');
var NodeParser = require('./nodeparser');
var NodeContainer = require('./nodecontainer');
var log = require('./log');
var utils = require('./utils');
var createWindowClone = require('./clone');
var loadUrlDocument = require('./proxy').loadUrlDocument;
var getBounds = utils.getBounds;

var html2canvasNodeAttribute = "data-html2canvas-node";
var html2canvasCloneIndex = 0;

function html2canvas(nodeList, options) {
    var index = html2canvasCloneIndex++;
    options = options || {};
    if (options.logging) {
        log.options.logging = true;
        log.options.start = Date.now();
    }

    if (!options.scale) { options.scale = window.devicePixelratio; }
    if (!options.padding) {
      options.padding = {left: 0, right: 0, top: 0, bottom: 0};
    } else if (typeof options.padding == 'Number') {
      options.padding = {left: options.padding, right: options.padding, top: options.padding, bottom: options.padding};
    }
		if (options.width) { options.width *= options.scale; }
		if (options.height) { options.height *= options.scale; }

    options.async = typeof(options.async) === "undefined" ? true : options.async;
    options.allowTaint = typeof(options.allowTaint) === "undefined" ? false : options.allowTaint;
    options.removeContainer = typeof(options.removeContainer) === "undefined" ? true : options.removeContainer;
    options.javascriptEnabled = typeof(options.javascriptEnabled) === "undefined" ? false : options.javascriptEnabled;
    options.imageTimeout = typeof(options.imageTimeout) === "undefined" ? 10000 : options.imageTimeout;
    options.renderer = typeof(options.renderer) === "function" ? options.renderer : CanvasRenderer;
    options.strict = !!options.strict;
    options.proxyWithCredentials = !!options.proxyWithCredentials;

    if (typeof(nodeList) === "string") {
        if (typeof(options.proxy) !== "string") {
            return Promise.reject("Proxy must be used when rendering url");
        }
        var width = options.width != null ? options.width : window.innerWidth;
        var height = options.height != null ? options.height : window.innerHeight;
        return loadUrlDocument(absoluteUrl(nodeList), options.proxy, document, width, height, options).then(function(container) {
            return renderWindow(container.contentWindow.document.documentElement, container, options, width, height);
        });
    }

    var node = ((nodeList === undefined) ? [document.documentElement] : ((nodeList.length) ? nodeList : [nodeList]))[0];
    node.setAttribute(html2canvasNodeAttribute + index, index);
    return renderDocument(node.ownerDocument, options, node.ownerDocument.defaultView.innerWidth, node.ownerDocument.defaultView.innerHeight, index).then(function(canvas) {
        if (typeof(options.onrendered) === "function") {
            log("options.onrendered is deprecated, html2canvas returns a Promise containing the canvas");
            options.onrendered(canvas);
        }
        return canvas;
    });
}

html2canvas.CanvasRenderer = CanvasRenderer;
html2canvas.NodeContainer = NodeContainer;
html2canvas.log = log;
html2canvas.utils = utils;

var html2canvasExport = (typeof(document) === "undefined" || typeof(Object.create) !== "function" || typeof(document.createElement("canvas").getContext) !== "function") ? function() {
    return Promise.reject("No canvas support");
} : html2canvas;

module.exports = html2canvasExport;

if (typeof(define) === 'function' && define.amd) {
    define('html2canvas', [], function() {
        return html2canvasExport;
    });
}

function renderDocument(document, options, windowWidth, windowHeight, html2canvasIndex) {
    return createWindowClone(document, document, windowWidth, windowHeight, options, document.defaultView.pageXOffset, document.defaultView.pageYOffset).then(function(container) {
        log("Document cloned");
        var attributeName = html2canvasNodeAttribute + html2canvasIndex;
        var selector = "[" + attributeName + "='" + html2canvasIndex + "']";
        document.querySelector(selector).removeAttribute(attributeName);
        var clonedWindow = container.contentWindow;
        var node = clonedWindow.document.querySelector(selector);
        var oncloneHandler = (typeof(options.onclone) === "function") ? Promise.resolve(options.onclone(clonedWindow.document)) : Promise.resolve(true);
        return oncloneHandler.then(function() {
            return renderWindow(node, container, options, windowWidth, windowHeight);
        });
    });
}

function renderWindow(node, container, options, windowWidth, windowHeight) {

    var clonedWindow = container.contentWindow;
    var support = new Support(clonedWindow.document);
    var imageLoader = new ImageLoader(options, support);
    var bounds = getBounds(node);
    var width = options.type === "view" ? windowWidth : documentWidth(clonedWindow.document);
    var height = options.type === "view" ? windowHeight : documentHeight(clonedWindow.document);
    var renderer = new options.renderer(width*options.scale, height*options.scale, imageLoader, options, document);
    var parser = new NodeParser(node, renderer, support, imageLoader, options);

    var result = new Promise(function (resolve, reject) {
      parser.ready.then(function() {
          log("Finished rendering");
          var canvas;
          if (options.type === "view") {
              canvas = crop(renderer.canvas, {width: renderer.canvas.width, height: renderer.canvas.height, top: 0, left: 0, x: 0, y: 0}, options);
          } else if (node === clonedWindow.document.body || node === clonedWindow.document.documentElement || options.canvas != null) {
              canvas = renderer.canvas;
          } else {
              canvas = crop(renderer.canvas, {width:  options.width != null ? options.width : bounds.width, height: options.height != null ? options.height : bounds.height, top: bounds.top, left: bounds.left, x: 0, y: 0}, options);
          }

          if (options.caption) {
            var captionDiv = document.createElement('div');
            captionDiv.innerHTML = options.caption;
            captionDiv.style.position = 'absolute';
            captionDiv.style.left = 0;
            captionDiv.style.top = document.body.scrollTop + 'px';
            captionDiv.style.zIndex = '1000001';
            captionDiv.style.width = (options.width/options.scale + options.padding.left + options.padding.right)+'px';
            captionDiv.style.maxWidth = captionDiv.style.width;
            clonedWindow.document.body.appendChild(captionDiv);

            var captionParser = new NodeParser(captionDiv, renderer, support, imageLoader, options);
            captionParser.ready.then(function () {
              var ctx = canvas.getContext("2d");
              var capWidth = captionDiv.offsetWidth * options.scale;
              var capHeight = captionDiv.offsetHeight * options.scale;
              var capY = (options.height != null ? options.height : bounds.height) + (options.padding.top + options.padding.bottom)*options.scale - capHeight;
              ctx.drawImage(renderer.canvas, 0, 0, capWidth, capHeight, 0, capY, capWidth, capHeight);
              cleanupContainer(container, options);
              resolve(canvas);
            });
          }else {
            cleanupContainer(container, options);
            resolve(canvas);
          }
      });
    }).then(function (canvas) {
      return canvas;
    });
    return result;
}

function cleanupContainer(container, options) {
    if (options.removeContainer) {
        container.parentNode.removeChild(container);
        log("Cleaned up container");
    }
}

function crop(canvas, bounds, options) {
    var croppedCanvas = document.createElement("canvas");
    var x1 = Math.min(canvas.width * options.scale - 1, Math.max(0, bounds.left) * options.scale );
    var x2 = Math.min(canvas.width * options.scale, Math.max(1, bounds.left + bounds.width) * options.scale);
    var y1 = Math.min(canvas.height * options.scale - 1, Math.max(0, bounds.top) * options.scale);
    var y2 = Math.min(canvas.height * options.scale, Math.max(1, bounds.top + bounds.height) * options.scale);
    croppedCanvas.width = bounds.width + (options.padding.left + options.padding.right) * options.scale;
    croppedCanvas.height =  bounds.height + (options.padding.top + options.padding.bottom) * options.scale;
    var width = x2-x1;
    var height = y2-y1;
    log("Cropping canvas at:", "left:", bounds.left, "top:", bounds.top, "width:", width, "height:", height);
    log("Resulting crop with width", bounds.width, "and height", bounds.height, "with x", x1, "and y", y1);
    var ctx = croppedCanvas.getContext("2d");
    if (options.background) {
      ctx.beginPath();
      ctx.rect(0, 0, croppedCanvas.width, croppedCanvas.height);
      ctx.fillStyle = options.background;
      ctx.fill();
    }
    ctx.drawImage(canvas, x1, y1, width, height, bounds.x + options.padding.left*options.scale, bounds.y + options.padding.top*options.scale, width, height);
    return croppedCanvas;
}

function documentWidth (doc) {
    return Math.max(
        Math.max(doc.body.scrollWidth, doc.documentElement.scrollWidth),
        Math.max(doc.body.offsetWidth, doc.documentElement.offsetWidth),
        Math.max(doc.body.clientWidth, doc.documentElement.clientWidth)
    );
}

function documentHeight (doc) {
    return Math.max(
        Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight),
        Math.max(doc.body.offsetHeight, doc.documentElement.offsetHeight),
        Math.max(doc.body.clientHeight, doc.documentElement.clientHeight)
    );
}

function absoluteUrl(url) {
    var link = document.createElement("a");
    link.href = url;
    link.href = link.href;
    return link;
}
