
var _ = require('underscore');

var Context = require('./lib/Context');


function define(config, creator, publisher) {

	if (_.isFunction(config)) {
		publisher = creator;
		creator = config;
		config = {};
	}

	config.creator = creator;
	config.publisher = publisher;

	return new Context(config, config.timeout);

}

/*var definitions = [];

global.define = function () {
	definitions.push(define.apply(this, arguments));
};

require('./test/example');

_.invoke(definitions, 'run', function (err) {
	if (err) throw err;
});*/
