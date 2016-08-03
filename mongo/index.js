// Generated by CoffeeScript 1.10.0
(function() {
  var Mongo, _, async, dbByKey, mongodb,
    slice = [].slice;

  async = require('async');

  mongodb = require('mongodb');

  _ = require('underscore');

  dbByKey = {};

  Mongo = (function() {
    Mongo.ObjectId = mongodb.ObjectId;

    Mongo.term = function(key) {
      var db;
      db = dbByKey[key];
      dbByKey[key] = null;
      if (db) {
        return db.close();
      }
    };

    Mongo.topology = function(config) {
      var host, i, len, port, ref, ref1, servers;
      if (!config.type || config.type === 'server') {
        if (!(config.host && config.port)) {
          throw Error('Ignore host, port');
        }
        return mongodb.Server(config.host, config.port);
      }
      if (!_.isArray(config.hosts)) {
        throw Error("Ignore hosts");
      }
      servers = [];
      ref = config.hosts;
      for (i = 0, len = ref.length; i < len; i++) {
        host = ref[i];
        ref1 = host.split(':'), host = ref1[0], port = ref1[1];
        port = parseInt(port) || 27017;
        servers.push(mongodb.Server(host, port));
      }
      if (config.type === 'replset') {
        return mongodb.ReplSet(servers);
      }
      if (config.type === 'mongos') {
        return mongodb.Mongos(servers);
      }
      throw Error("Unknown topology: " + (JSON.stringify(config)));
    };

    Mongo.connect = function(key, config) {
      var db;
      if (dbByKey[key]) {
        db = dbByKey[key];
        return;
      }
      if (config.authdbname) {
        db = new mongodb.Db(config.authdbname, this.topology(config), {
          safe: true
        });
        db.open(function(err) {
          if (err) {
            throw Error(err);
          }
          return db.authenticate(config.user, config.password, (function(_this) {
            return function(err) {
              if (err) {
                throw Error(err);
              }
              db = db.db(config.database);
              db.opened = true;
              return dbByKey[key] = db;
            };
          })(this));
        });
      } else {
        db = new mongodb.Db(config.database, this.topology(config), {
          safe: true
        });
        db.open(function(err) {
          if (err) {
            throw Error(err);
          }
          return db.opened = true;
        });
      }
      dbByKey[key] = db;
      return db.on('close', function() {
        if (dbByKey[key] !== null) {
          dbByKey[key] = void 0;
          return Mongo.connect(key, config);
        }
      });
    };

    Mongo.getByNS = function(config, ns) {
      var collectionName, dbName, splitted;
      splitted = ns.split('.');
      dbName = splitted.shift();
      collectionName = splitted.join('.');
      return new Mongo(_.extend({}, config, {
        database: dbName,
        collection: collectionName
      }));
    };

    Mongo.prototype._db = function() {
      return dbByKey[this.key];
    };

    Mongo.prototype._col = function(done) {
      return this.init((function(_this) {
        return function(err, db) {
          return done(err, db.collection(_this.config.collection));
        };
      })(this));
    };

    Mongo.prototype.ns = function() {
      return this.config.database + "." + this.config.collection;
    };

    function Mongo(config1) {
      this.config = config1;
      this.initCallbacks = [];
      this.key = "" + this.config.type + this.config.host + this.config.port + this.config.hosts + this.config.authdbname + this.config.user + this.config.database;
      Mongo.connect(this.key, this.config);
    }

    Mongo.prototype.getmeta = function(done) {
      return this.findOne({
        _id: '.meta'
      }, (function(_this) {
        return function(err, meta) {
          _this.meta = meta;
          return done(err, _this.meta);
        };
      })(this));
    };

    Mongo.prototype.initialized = function(done) {
      return done(null);
    };

    Mongo.prototype.callInitialized = function(done) {
      if (this.called) {
        return done(null);
      }
      this.called = true;
      return this.initialized(done);
    };

    Mongo.prototype.init = function(done) {
      if (this._db().opened) {
        this.callInitialized((function(_this) {
          return function() {
            return done(null, _this._db());
          };
        })(this));
        return;
      }
      this.initCallbacks.push(done);
      return this.interval || (this.interval = setInterval((function(_this) {
        return function() {
          if (_this._db().opened) {
            clearInterval(_this.interval);
            return _this.callInitialized(function() {
              var callback, i, len, ref;
              ref = _this.initCallbacks;
              for (i = 0, len = ref.length; i < len; i++) {
                callback = ref[i];
                callback(null, _this._db());
              }
              return _this.initCallbacks = [];
            });
          }
        };
      })(this), 100));
    };

    Mongo.prototype.bulkInsert = function(docs, done) {
      return this._col((function(_this) {
        return function(err, col) {
          var bulk;
          bulk = null;
          return async.eachSeries(docs, function(doc, done) {
            if (!bulk) {
              bulk = col.initializeUnorderedBulkOp();
            }
            bulk.insert(doc);
            if (bulk.length < 3) {
              return done(null);
            }
            return bulk.execute(function(err, result) {
              bulk = null;
              return done(err);
            });
          }, function(err) {
            if (!bulk) {
              return done(err);
            }
            return bulk.execute(done);
          });
        };
      })(this));
    };

    Mongo.prototype.bulkUpdate = function(updates, done) {
      return this._col((function(_this) {
        return function(err, col) {
          var bulk;
          bulk = null;
          return async.eachSeries(updates, function(update, done) {
            var bulkOp;
            if (!bulk) {
              bulk = col.initializeUnorderedBulkOp();
            }
            bulkOp = bulk.find(update[0]);
            if (!update[2]) {
              bulkOp = bulkOp.upsert();
            }
            bulkOp.updateOne(update[1]);
            if (bulk.length < 3) {
              return done(null);
            }
            return bulk.execute(function(err, result) {
              bulk = null;
              return done(err);
            });
          }, function(err) {
            if (!bulk) {
              return done(err);
            }
            return bulk.execute(done);
          });
        };
      })(this));
    };

    Mongo.prototype.createIndex = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.createIndex.apply(col, args);
      });
    };

    Mongo.prototype.count = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.count.apply(col, args);
      });
    };

    Mongo.prototype.find = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.find.apply(col, args);
      });
    };

    Mongo.prototype.findAsArray = function() {
      var args, callback;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      callback = args.pop();
      args.push(function(err, cursor) {
        if (err) {
          return done(err);
        }
        return cursor.toArray(callback);
      });
      return this.find.apply(this, args);
    };

    Mongo.prototype.findOne = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.findOne.apply(col, args);
      });
    };

    Mongo.prototype.findAndModify = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.findAndModify.apply(col, args);
      });
    };

    Mongo.prototype.distinct = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.distinct.apply(col, args);
      });
    };

    Mongo.prototype.insert = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.insert.apply(col, args);
      });
    };

    Mongo.prototype.update = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.update.apply(col, args);
      });
    };

    Mongo.prototype.drop = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.drop.apply(col, args);
      });
    };

    Mongo.prototype.remove = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.remove.apply(col, args);
      });
    };

    Mongo.prototype.removeOne = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.removeOne.apply(col, args);
      });
    };

    Mongo.prototype.aggregate = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.aggregate.apply(col, args);
      });
    };

    Mongo.prototype.rename = function() {
      var args;
      args = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      return this._col(function(err, col) {
        return col.rename.apply(col, args);
      });
    };

    Mongo.inBatch = function(cursor, batchSize, formatter, callback, done) {
      return cursor.count(function(err, all) {
        var count, elements, stream;
        if (err) {
          return done(err);
        }
        if (!all) {
          return done(null);
        }
        count = 0;
        stream = cursor.stream();
        elements = [];
        return stream.on('data', function(data) {
          elements.push(formatter(data));
          count++;
          if (elements.length >= batchSize || all === count) {
            stream.pause();
            return callback(elements, function(err) {
              elements = [];
              stream.resume();
              if (all === count) {
                return done(null);
              }
            });
          }
        });
      });
    };

    Mongo.prototype.term = function(done) {
      Mongo.term(this.key);
      return done(null);
    };

    return Mongo;

  })();

  module.exports = Mongo;

}).call(this);
