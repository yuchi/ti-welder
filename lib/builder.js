
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var _ = require('underscore');

var Canvas = require('canvas');

module.exports = Builder;

Builder.ImageBuilder = ImageBuilder;

function Builder(fn, basepath) {
	this.fn = fn;
	this.basepath = basepath;
}

Builder.prototype.make = function(files, callback) {
	// TODO Async!
	console.log("");
	_.each(files, this.makeFile, this);
	console.log("");
};

Builder.prototype.makeFile = function(file) {
	// TODO Async!

	console.log("  Generate file " + file.path);

	var imageBuilder = new ImageBuilder(file, this.basepath);
	this.fn.call(imageBuilder, imageBuilder);
	imageBuilder.writeFile();
};

function ImageBuilder(file, basepath) {
	this.file = file;
	this.basepath = basepath;

	this.density = file.density;

	this.width = file.width;
	this.height = file.height;

	this.realWidth = this.real(this.width);
	this.realHeight = this.real(this.height);

	this.canvas = new Canvas(this.realWidth, this.realHeight);
	this.ctx = this.canvas.getContext('2d');
}

ImageBuilder.prototype.writeFile = function() {

	mkdirp.sync(path.resolve(this.basepath, this.file.directory));

	var format = this.file.format.toLowerCase();

	var filename = path.resolve(this.basepath, this.file.path);

	var out = fs.createWriteStream(filename);

	var stream;

	if (format === 'png') {
		stream = this.canvas.pngStream();
	}
	else if (format === 'jpg' || format === 'jpeg') {
		stream = this.canvas.createJPEGStream({
			bufsize : 2048,
			quality : 80
		});
	}

	stream.pipe(out);

	//fs.writeFileSync(filename, this.canvas.toBuffer());
};

ImageBuilder.prototype.real = function(n) {
	return Math.round(this.density * n);
};

ImageBuilder.prototype.fillRepeat = function(src, config) {

	ensureSize(config);

	// TODO Resize

	var image = new Canvas.Image();
	image.src = path.join(this.basepath, src);

	var pattern = this.ctx.createPattern(image, 'repeat');

	this.ctx.fillStyle = pattern;
	this.ctx.fillRect(0, 0, this.realWidth, this.realHeight);
};

ImageBuilder.prototype.fill = function(color) {
	this.ctx.fillStyle = color;
	this.ctx.fillRect(0, 0, this.realWidth, this.realHeight);
};

ImageBuilder.prototype.place = function(src, config) {
	
	ensureSize(config);

	var x = 0;
	var y = 0;

	if (config.top != null) {
		y = config.top;
	}
	else if (config.bottom != null) {
		y = this.height - (config.bottom + config.height);
	}

	if (config.left != null) {
		x = config.left;
	}
	else if (config.right != null) {
		x = this.width - (config.width + config.right)
	}

	var image = new Canvas.Image();
	image.src = fs.readFileSync(path.join(this.basepath, src));

	this.ctx.drawImage(image, this.real(x), this.real(y), this.real(config.width), this.real(config.height));

	image.onload = function () {
		console.log('mbeah');
	}.bind(this);
};

function ensureSize(config) {
	if (config.size) {
		config.width = config.size[0];
		config.height = config.size[1];
	}
	else if (config.width != null && config.height != null) {
		config.size = [config.width, config.height];
	}
	else {
		throw new Error("Wrong size values");
	}
}
