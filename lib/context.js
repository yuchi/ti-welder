
var _ = require('underscore');

var Publisher = require('./publisher');
var Builder = require('./builder');

module.exports = Context;

function Context(config) {
	this.config = config;
	this.publisher = new Publisher(config.publisher, config.timeout);
	this.builder = new Builder(config.builder, config.basepath);
}

Context.prototype.run = function(callback) {
	var that = this;
	this.publisher.generatePaths(function (err, files) {
		if (err) return callback(err);
		this.logFiles(files);
		this.builder.make(files, function (err) {
			if (err) return callback(err);
			callback(null);
		}.bind(this));
	}.bind(this));
};

Context.prototype.logFiles = function(files) {
	console.log("");
	console.log("  Files to be generated:");
	console.log("");
	_.each(files, function (file) {
		console.log("  - " + file.path);
	});
};
