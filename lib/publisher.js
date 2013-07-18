
var path = require('path');
var _ = require('underscore');

var slice = Array.prototype.slice;

module.exports = Publisher;

Publisher.PathGenerator = PathGenerator;

function Publisher(fn, timeout) {
	this.fn = fn;
	this.timeout = timeout || 1e3;
}

Publisher.prototype.generatePaths = function (callback) {

	var generators = [];

	var timeoutId;

	callback = _.once(callback);

	function result(config) {
		var generator = new PathGenerator(config || {});

		generators.push(generator);

		generator.branch = function () {

			var branch;

			if (arguments.length === 0) {
				branch = this.clone();
				this.deactivate();
				branch.activate();
				generators.push(branch);

				return branch;
			}
			else {
				_.each(arguments, function (fn) {
					var branch = this.branch();
					fn.call(branch, branch);
				}, this);

				return this;
			}
		}

		return generator;
	}

	function timeout() {
		callback(new Error("Path generation took more than 1 second"));
	}

	function conclude() {
		timeoutId && clearTimeout(timeoutId);
		var paths = _.flatten(_.invoke(generators, 'generate'));
		callback(null, paths);
	}

	if (this.fn.length === 1) {
		this.fn(result);
		conclude();
	}
	else if (this.fn.length === 2) {
		timeoutId = setTimeout(timeout, this.timeout);
		this.fn(result, conclude);
	}
	else {
		new Error("Async path generator has wrong number of arguments");
	}
};

function PathGenerator(config) {
	this.config = config;
	this._procedures = {};
	this._data = {};
}

PathGenerator.prototype.activate = function () {
	this._active = true;
};

PathGenerator.prototype.deactivate = function () {
	this._active = false;
};

PathGenerator.prototype.clone = function () {
	return _.extend(new PathGenerator(), this, {
		config: _.clone(this.config),
		_procedures: _.clone(this._procedures)
	});
};

PathGenerator.prototype.generate = function () {
	var files = _.map(this.raw(), this.augment, this);
	return files;
};

function ratio(a, b) {
	return a > b ? a/b : b/a;
}

PathGenerator.prototype.augment = function (file) {

	var size = file.size;
	var caps = file.caps;

	file.originalSize = size;

	file.originalWidth = size[0];
	file.originalHeight = size[1];
	file.originalRatio = ratio(size[0], size[1]);

	size[0] = size[0] - caps[0];
	size[1] = size[1] - caps[1];

	file.width = size[0];
	file.height = size[1];
	file.ratio = ratio(size[0], size[1]);

	file.square = size[0] === size[1];
	file.portrait = size[0] < size[1];
	file.landscape = size[0] > size[1];

	file.retina = file.density === 2;
	file.notRetina = file.density !== 2;

	file.xhdpi = file.density === 2;
	file.hdpi = file.density === 1.5;
	file.mdpi = file.density === 1;
	file.ldpi = file.density === 0.75;

	file.long = file.originalRatio > 1.5;
	file.notlong = !file.long;

	_.each(this._data, function (value, name) {
		if (_.isFunction(value)) {
			value = value.call(file, file, this);
		}
		file[name] = value;
	});

	_.each(this._procedures, function (list, prop) {
		_.each(list, function (fn) {
			file[prop] = fn.call(file, file, this);
		});
	});

	file.path = this.buildFullPath(file);

	return file;
};

PathGenerator.prototype.buildFullPath = function (file) {
	var filename = file.filename;

	if (this.config.addExtension !== false) {
		filename += '.' + file.format.toLowerCase();
	}

	return path.join(file.directory, filename);
};

PathGenerator.prototype.raw = function () {

	if (this._active === false) {
		return [];
	}

	var that = this;

	var files = [];

	var push = _.bind(files.push, files);

	function toString(o) {
		return o.toString(10);
	}

	function prop(prop, def, fn) {
		var value = that['_' + prop];
		_.each((value && _.uniq(value, toString)) || def, fn, that);
	}

	function each(l, fn) {
		_.each(_.uniq(l, toString), fn, that);
	}

	var NO_DEF = ['ERROR'];

	var sizes;

	if (this._rotate) {
		sizes = _.map(this._sizes, function (size) {
			return [size[1], size[0]];
		}).concat(this._sizes);
	}
	else {
		sizes = this._sizes;
	}

	prop('densities', [1], function (density) {
		each(sizes, function (size) {
			prop('caps', [[0, 0]], function (caps) {
				prop('formats', ['png'], function (format) {
					prop('filenames', NO_DEF, function (filename) {
						prop('directories', NO_DEF, function (directory) {
							push({
								format: format,
								directory: directory,
								filename: filename,
								density: density,
								size: size,
								caps: caps
							});
						});
					});
				});
			});
		});
	});

	return files;
};

// Setters

function defineSetter(singular, plural, property) {
	plural || (plural = singular + 's');
	property || (property = '_' + plural);

	function setOne(el) {
		if (_.isFunction(el)) {
			return this.procedure(singular, el);
		}
		else {
			return setMany.apply(this, arguments);
		}
	}

	function setMany() {
		this[property] = (this[property] || []).concat(slice.call(arguments));
		return this;
	}

	PathGenerator.prototype[singular] = setOne;
	PathGenerator.prototype[plural] = setMany;
}

defineSetter('density', 'densities');
defineSetter('size')
defineSetter('format');
defineSetter('filename');
defineSetter('directory', 'directories');
defineSetter('cap');

PathGenerator.prototype.rotate = function (val) {
	this._rotate = arguments.length > 0 ? val : true;
	return this;
};

PathGenerator.prototype.data = function (data) {
	this._data = _.extend({}, this._data, data);
	return this;
};

PathGenerator.prototype.procedure = function (name, fn) {
	this._procedures[name] = (this._procedures[name] || []).concat([fn]);
	return this;
};

PathGenerator.prototype.replace = function (property, from, to) {
	var fn = to;

	if (_.isString(to)) {
		fn = function () {
			return this[to];
		};
	}

	this[property].call(this, function () {
		return this[property].replace(from, to.call(this, this));
	});
	return this;
};

PathGenerator.prototype.matrix = function () {
	_.each(arguments, function (m) {
		var size = m.slice(1);
		var density = m[0];
		this.branch(function () {
			this.density(density).size(size);
		});
	}, this);
};
