
var path = require('path');
var _ = require('underscore');

var slice = Array.prototype.slice;

module.exports = Publisher;

Publisher.PathGenerator = PathGenerator;

function Publisher(fn, timeout) {
	this.fn = fn;
	this.timeout = timeout || 1e3;
}

Publisher.prototype.generatePaths = function(callback) {

	var generators = [];

	var timeoutId;

	callback = _.once(callback);

	function result(config) {
		var generator = new PathGenerator(config || {});

		generators.push(generator);

		generator.branch = function () {
			_.each(arguments, function (fn) {
				var branch = this.clone();
				branch.activate();
				this.deactivate();
				generators.push(branch);
				fn(branch);
			}, this);

			return this;
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
}

PathGenerator.prototype.activate = function () {
	this._active = true;
};

PathGenerator.prototype.deactivate = function () {
	this._active = false;
};

PathGenerator.prototype.clone = function() {
	return _.extend(new PathGenerator(), this, {
		config: _.clone(this.config),
		_procedures: _.clone(this._procedures)
	});
};

PathGenerator.prototype.generate = function() {
	var files = _.map(this.raw(), this.augment, this);
	return files;
};

PathGenerator.prototype.augment = function(file) {

	var size = file.size;

	file.width = size[0];
	file.height = size[1];

	file.square = size[0] === size[1];
	file.portrait = size[0] < size[1];
	file.landscape = size[0] > size[1];

	file.retina = file.density === 2;
	file.notRetina = file.density !== 2;

	file.xhdpi = file.density === 2;
	file.hdpi = file.density === 1.5;
	file.mdpi = file.density === 1;

	_.each(this._procedures, function (list, prop) {
		_.each(list, function (fn) {
			file[prop] = fn.call(file, file, this);
		});
	});

	file.path = this.buildFullPath(file);

	return file;
};

PathGenerator.prototype.buildFullPath = function(file) {
	var filename = file.filename;

	if (this.config.addExtension !== false) {
		filename += '.' + file.format.toLowerCase();
	}

	return path.join(file.directory, filename);
};

PathGenerator.prototype.raw = function() {

	if (this._active === false) {
		return [];
	}

	var that = this;

	var files = [];

	var push = _.bind(files.push, files);

	function map(prop, def, fn) {
		_.each(that['_' + prop] || def, fn, that);
	}

	var NO_DEF = ['ERROR'];

	map('densities', [1], function (density) {
		map('sizes', NO_DEF, function (size) {
			map('formats', ['png'], function (format) {
				map('filenames', NO_DEF, function (filename) {
					map('directories', NO_DEF, function (directory) {
						push({
							format: format,
							directory: directory,
							filename: filename,
							density: density,
							size: size
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

PathGenerator.prototype.procedure = function(name, fn) {
	this._procedures[name] = (this._procedures[name] || []).concat([fn]);
	return this;
};
