
var _ = require('underscore');

var Publisher = require('./publisher');

module.exports = Context;

function Context(config) {
	this.config = config;
	//this.creator = config.creator;
	this.publisher = new Publisher(config.publisher);
}

Context.prototype.run = function(callback) {
	var that = this;
	this.publisher.generatePaths(function (err, files) {
		if (err) return callback(err);
		console.dir(_.pluck(files, 'path'));
	}.bind(this));
};
