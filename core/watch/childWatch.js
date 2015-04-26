// Runs as a child process through forever-monitor

'use strict';

var path = require('path');
var watch = require('gulp-watch');
var deepExtend = require('deep-extend');
var commander = require('commander');

// Parse arguments
commander
    .option('-r, --root [string]', 'Root path of the SourceJS app', '../../')
    .option('-l, --log [string]', 'Log level', 'info')
    .parse(process.argv);

global.commander = global.commander || commander;

// Normalized path to master app
global.pathToApp = global.pathToApp || path.join(__dirname, commander.root).replace(/\\/g, '/').replace(/\/$/, '');

var loadOptions = require(path.join(global.pathToApp, 'core/loadOptions'));
global.opts = global.opts || loadOptions(path.resolve(global.pathToApp));

var logger = require(path.join(global.pathToApp, 'core/logger'));
var log = logger.log;
global.log = log;

var fileTree = require(path.join(global.pathToApp, 'core/file-tree'));

var config = {
    enabled: true,
    ignoreHiddenFiles: true
};
// Overwriting base options
deepExtend(config, global.opts.core.watch);

var prepareData = function(data, targetFile){
    var dir = path.dirname(targetFile);

    return deepExtend(fileTree.getSpecMeta(dir), data);
};

if (config.enabled){
    watch(global.pathToApp + '/**/info.json', function(vinyl){
        var filePath = vinyl.path.replace(/\\/g, '/');
        var event = vinyl.event;
        var cleanPath = filePath.replace(global.pathToApp + '/', '').replace(global.opts.core.common.pathToUser +'/', '');
        var specID = path.dirname(cleanPath);
        var rawContents;

        global.log.debug('event', event);
        global.log.debug('changed file', filePath);

        try {
            rawContents = JSON.parse(String(vinyl.contents));
        } catch(e) {}

        // TODO: run full re-index on huge changes (like git update)

        if (rawContents && (event === 'change' || event === 'add')) {
            var dataToSend = {};
            dataToSend[specID + '/specFile'] = prepareData(rawContents, filePath);

            fileTree.updateFileTree(dataToSend, true);
        }

        if (typeof rawContents === 'undefined' || event === 'unlink') {
            fileTree.deleteFromFileTree(specID);
        }
    });
}