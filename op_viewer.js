// Generated by CoffeeScript 1.10.0
(function() {
  'use strict';
  var Logger, OpViewer, OplogReader;

  Logger = require('./logger');

  OplogReader = require('./oplog_reader');

  OpViewer = (function() {
    function OpViewer(config) {
      this.config = config;
      this.logger = new Logger(this.config.options.loglv);
      this.config.options.bulkLimit = 100000;
      this.config.options.bulkInterval = 10000;
      this.oplogReader = new OplogReader(this.config);
    }

    OpViewer.prototype.start = function() {
      this.logger.info('View mode interval=', this.config.options.view_interval);
      this.oplogReader.init();
      return this.oplogReader.getTailTS((function(_this) {
        return function(err, last) {
          var bulkCallback, eachCallback;
          if (err) {
            throw err;
          }
          _this.opsByNs = {};
          _this.all = 0;
          _this.firstLog = false;
          eachCallback = function(oplog, done) {
            var base, name, ops;
            _this.firstLog = true;
            (base = _this.opsByNs)[name = oplog.ns] || (base[name] = {
              m: 0,
              c: 0,
              i: 0,
              u: 0,
              d: 0
            });
            ops = _this.opsByNs[oplog.ns];
            if (oplog.fromMigrate) {
              ops.m++;
            } else if (oplog.op === 'n') {

            } else if (oplog.op === 'c') {
              ops.c++;
            } else if (oplog.op === 'i') {
              ops.i++;
            } else if (oplog.op === 'u') {
              ops.u++;
            } else if (oplog.op === 'd') {
              ops.d++;
            }
            _this.all++;
            return done(null, oplog);
          };
          bulkCallback = function(oplogs, done) {
            return done(null);
          };
          setInterval(function() {
            var ns, ops, ref, time;
            if (!_this.firstLog) {
              _this.logger.info('Waiting for moving cursor to tail');
              return;
            }
            time = new Date().toISOString();
            _this.logger.info(time + ": ALL: " + _this.all);
            ref = _this.opsByNs;
            for (ns in ref) {
              ops = ref[ns];
              _this.logger.info(" " + ns + " : i: " + ops.i + ", u: " + ops.u + ", d: " + ops.d + ", c: " + ops.c + ", m: " + ops.m);
            }
            _this.opsByNs = {};
            return _this.all = 0;
          }, _this.config.options.view_interval);
          return _this.oplogReader.start(last.ts, eachCallback, bulkCallback, function(err) {});
        };
      })(this));
    };

    return OpViewer;

  })();

  module.exports = OpViewer;

}).call(this);