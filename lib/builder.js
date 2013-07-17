
var fs = require('fs');
var path = require('path');
var mkdirp = require('mkdirp');
var _ = require('underscore');

var Canvas = require('canvas');

module.exports = Builder;

Builder.ImageBuilder = ImageBuilder;

function Builder(fn, basepath, force) {
	this.fn = fn;
	this.basepath = basepath;
	this.force = force;
}

Builder.prototype.make = function (files, callback) {
	// TODO Async!
	console.log("");

	files = [].concat(files);

	var next = function (err) {

		if (err) {
			return callback(err);
		}

		if (!files.length) {
			console.log("");
			return callback(null);
		}

		var file = files.shift();
		this.makeFile(file, next);

	}.bind(this);

	next(null);

};

Builder.prototype.makeFile = function (file, callback) {
	// TODO Async!

	var imageBuilder = new ImageBuilder(file, this.basepath);

	console.log("  Generating file " + file.path);

	var fn = this.fn;

	try {
		if (fn.length === 1) {
			// Sync
				fn.call(imageBuilder, imageBuilder);
				imageBuilder.writeFile(callback);
			}
		else if (fn.length === 2) {
			fn.call(imageBuilder, imageBuilder, function (err) {
				if (err) return callback(err);
				try {
					imageBuilder.writeFile(callback);
				}
				catch (err) {
					callback(err);
				}
			});
		}
	}
	catch (err) {
		callback(err);
	}

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

ImageBuilder.prototype.writeFile = function (callback) {

	callback = _.once(callback);

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

	out.on('error', callback);
	stream.on('error', callback);

	stream.pipe(out);

	stream.on('end', function () {
		callback();		
	});

	//fs.writeFileSync(filename, this.canvas.toBuffer());
};

ImageBuilder.prototype.real = function (n) {
	return Math.round(this.density * n);
};

ImageBuilder.prototype.fillRepeat = function (src, config) {
	config = this.calculatePositions(config);

	// TODO Resize

	var image = new Canvas.Image();
	image.src = path.join(this.basepath, src);

	var pattern = this.ctx.createPattern(image, 'repeat');

	this.ctx.fillStyle = pattern;
	this.ctx.fillRect(0, 0, this.realWidth, this.realHeight);
};

ImageBuilder.prototype.fill = function (color) {
	this.ctx.fillStyle = color;
	this.ctx.fillRect(0, 0, this.realWidth, this.realHeight);
};

ImageBuilder.prototype.place = function (src, config) {
	config = this.calculatePositions(config);

	var image = new Canvas.Image();
	image.src = fs.readFileSync(path.join(this.basepath, src));

	this.ctx.drawImage(image, this.real(config.x), this.real(config.y), this.real(config.width), this.real(config.height));

	image.onload = function () {
		console.log('mbeah');
	}.bind(this);
};

ImageBuilder.prototype.rect = function (color, config) {
	config = this.calculatePositions(config);

	this.ctx.fillStyle = color;
	this.ctx.fillRect(this.real(config.x), this.real(config.y), this.real(config.width), this.real(config.height));
};

ImageBuilder.prototype.calculatePositions = function (config) {
	if (config.size) {
		config.width = config.size[0];
		config.height = config.size[1];
	}

	var x = 0,
		y = 0;

	var top = this.unit(config.top, this.height),
		right = this.unit(config.right, this.width),
		bottom = this.unit(config.bottom, this.height),
		left = this.unit(config.left, this.width);

	var width = this.unit(config.width, this.width),
		height = this.unit(config.height, this.height);

	var center = config.center || config.centre || {};

	if (center.length != null) {
		center = {
			x: center[0],
			y: center[1]
		};
	}

	center.x = this.unit(center.x, this.width);
	center.y = this.unit(center.y, this.height);

	if (top != null) {
		y = top;
		if (bottom != null) {
			if (height != null) {
				throw new RangeError("Cannot have `top`, `bottom` AND `height`");
			}
			else {
				height = this.height - top - bottom;
			}
		}
	}
	else if (bottom != null) {
		if (height != null) {
			y = this.height - (bottom + height);
		}
		else {
			throw new RangeError("Cannot have no `top` but a `bottom` and no `height`")
		}
	}

	if (left != null) {
		x = left;
		if (right != null) {
			if (width != null) {
				throw new RangeError("Cannot have `left`, `right` AND `width`");
			}
			else {
				width = this.width - left - right;
			}
		}
	}
	else if (right != null) {
		if (width != null) {
			x = this.width - (width + right)
		}
		else {
			throw new RangeError("Cannot have no `left` but a `right` and no `width`")
		}
	}

	if (center.y != null) {
		if (height != null) {
			y = center.y - height / 2;
		}
		else {
			throw new RangeError("Cannot calculate height to use with `center.y`");
		}
	}

	if (center.x != null) {
		if (width != null) {
			x = center.x - width / 2;
		}
		else {
			throw new RangeError("Cannot calculate width to use with `center.x`");
		}
	}

	if (y == null && height == null) {
		throw new RangeError("Unable to calculate vertical position");
	}

	if (x == null && width == null) {
		throw new RangeError("Unable to calculate horizontal position");
	}

	return {
		x: x,
		y: y,
		width: width,
		height: height,
		top: y,
		right: this.width - x - width,
		bottom: this.height - y - height,
		left: x
	};
};

ImageBuilder.prototype.unit = function(n, base) {
	if (n == null) {
		return undefined;
	}

	n = ("" + n).trim();

	if (n.charAt(n.length - 1) === '%') {
		return parseFloat(n, 10) / 100 * base;
	}
	else {
		return parseFloat(n, 10);
	}
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
