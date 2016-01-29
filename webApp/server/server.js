/**
 * Created on 1/28/16
 */
var express = require('express');
var path = require('path');
var bodyParser = require('body-parser');
var webpack = require('webpack');
var config = require('../webpack.config.dev');

var MongoClient = require('mongodb');
var mongoose = require('mongoose');
var Admin = mongoose.mongo.Admin;

var localMongo = 'mongodb://localhost:27017/';

var userSchema = mongoose.Schema({
  name: String
});

//heartCount = [number, time]
var streamSchema = mongoose.Schema({
  name: String,
  description: String,
  heartCountNum: Number,
  listenerMaxCount: Number,
  listenerLiveCount: Number,
  playing: Boolean,
  // image: String,
  timestamp: Date,
  location: [{type: Number}],
  creator: {type: mongoose.Schema.Types.ObjectId, ref: 'User'}
});

var connection = mongoose.createConnection(localMongo);
connection.once('open', function() {
  console.log('database is active');
});

var User = connection.model('User', userSchema);
var johndoe = new User({name: 'John Doe'});
johndoe.save(function(err) {
  if (err) {
    throw (err)
  }
  else {
    console.log('John Doe saved');
  }
});

var Stream = connection.model('Stream', streamSchema);
var muzak = new Stream({name: 'Generic 90s Song', heartCountNum: 0, 
  listenerMaxCount: 0, listenerLiveCount: 0, description: 'you hear it in elevators'
});


var app = express();
var port = process.env.PORT || 3000;
var compiler = webpack(config);

var encoder = require('./encoder');
var binaryServer = require('binaryjs').BinaryServer;
var binarySocketHandler = require('./binarySockets.js');

app.use(require('webpack-dev-middleware')(compiler, {
  noInfo: true,
  publicPath: config.output.publicPath
}));

//static routes
app.use(require('webpack-hot-middleware')(compiler));

app.use(express.static(__dirname + '/../src'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.use(require('webpack-hot-middleware')(compiler));

app.use(express.static(__dirname + '/../src'));

/*** Router

***/

app.get('/broadcast', function(req, res) {
  res.sendFile(path.join(__dirname + '/../public', 'index.html'));
});

app.post('/api/:stream', function(req, res) {
  //here we create a new stream and add it to the database
  var streamName = req.params.stream;
  var streamDesc = req.body.desc;
  var streamLocation = req.body.loc;
  var streamCreator = req.body.creator;
  console.log(req.body);

  User.findOne({name: streamCreator}, function(err, docs) {
    if (docs) {
      var creatorId = docs._id;
      var newStream = new Stream({name: streamName, 
        description: streamDesc,
        heartCountNum: 0,
        listenerMaxCount: 0,
        listenerLiveCount: 0,
        timestamp: Date.now(),
        playing: true,
        location: streamLocation,
        creator: creatorId
      });
      newStream.save(function(err) {
        if (err) {
          throw err;
          console.log('problem saving the new stream');
        }
        else {
          console.log('saved new stream');
          res.send('stream saved to db');
        }
      });
    }
    else {
      //for now, let's assume the user exists
      console.log('not found');
      res.send('not found');
    }
  });
});

app.get('/api/:stream', function(req, res) {
  //I need to extract the song name or id from the params.id
  //then I query the database and send the whole stream to the client
  var streamName = req.params.stream;
  Stream.findOne({name: streamName}, function(err, docs) {
    if (err) {
      throw err;
    }
    else {
      res.send(docs);
    }
  });
});

app.put('/api/listen/:stream', function(req, res) {
  //and for the listener to upheart -> we have to extract the change from the
  //req.body anyway
  var streamName = req.params.stream;
  //this is complicated enough, and I don't trust the findOneandUpdate method
  Stream.findOne({name: streamName}, function(err, stream) {
    stream.heartCountNum++;
    stream.save(function(err) {
      if (err) {
        return err;
      }
      else {
        res.send('uphearted');
      }
    });
  });
});

app.put('/api/broadcast/:stream', function(req, res) {
  //for the broadcaster to modify or change
    //we'll do a find/change query on the database here
  //how can I extract the data from the req?
  var streamName = req.params.stream;
  var streamDesc = req.body.desc;
  var streamLocation = req.body.loc;
  Stream.findOneAndUpdate({name: streamName}, {description: streamDesc, location: streamLocation}, 
    function(err, doc) {
      if (err) {
        throw err;
      }
      else {
        res.send(doc);
      }
    });
});

app.get('/api/streams', function(req, res) {
  //send back the whole database
  //I'm hoping we can refactor that later
  //send all current streams
  Stream.find({playing: true}, function(err, docs) {
    if (err) {
      throw err;
    }
    else {
      //sending an array of objects, each one has info
        //but if we want the creator's info, we'll have to do that separately
      res.send(docs);
    }
  });
});

app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname+ '/../src', 'index.html'));
});

var throttle = require('throttle'),
  encoder = require('./encoder');

encoder.stdin = {};

var binaryServer = require('binaryjs').BinaryServer;
var fs = require('fs');

// Stdin is expecting raw PCM data of the format:
var SAMPLE_SIZE = 16, // 16-bit samples, Little-Endian, Signed
  CHANNELS = 1, // 2 channels (left and right)
  SAMPLE_RATE = 44100; // 44,100 Hz sample rate.

// If we're getting raw PCM data as expected, calculate the number of bytes
// that need to be read for `1 Second` of audio data.
var BLOCK_ALIGN = SAMPLE_SIZE / 8 * CHANNELS, // Number of 'Bytes per Sample'
  BYTES_PER_SECOND = SAMPLE_RATE * BLOCK_ALIGN;

// A simple "Burst-on-Connect" implementation. We'll store the previous "10
// seconds" worth of raw PCM data, and send it each time a new Icecast
// connection is made.
encoder.bocData = bocData = [];
var bocSize = BYTES_PER_SECOND * 10; // 10 raw PCM seconds in bytes

function onInStreamPCM(chunk) {
  bocData.push(chunk);
  var removed = 0;
  while (currentBocSize() > bocSize) {
    removed += bocData.shift().length;
  }

  // If we've removed a number of bytes that isn't a multiple of BLOCK_ALIGN,
  // then we'd be left with a partial audio sample, which at best case reverses
  // the audio channels, and at worst makes the bytes 16-bit ints be offset by 1,
  // resulting in awful static sound.
  var stillToRemove = removed % BLOCK_ALIGN;
  while (stillToRemove > 0) {
    if (bocData[0].length <= stillToRemove) {
      stillToRemove -= bocData.shift().length;
    } else {
      bocData[0] = bocData[0].slice(stillToRemove);
      stillToRemove = 0;
    }
  }
}

function currentBocSize() {
  var size = 0,
    i = 0,
    l = bocData.length
  for (; i < l; i++) {
    size += bocData[i].length;
  }
  return size;
}

var name = "My Music",
  metaint = 8192;
encoder.name = name;
encoder.metaint = metaint;
// Array of HttpServerResponse objects that are listening clients.
encoder.clients = clients = [];
encoder.icecastClients = icecastClients = [];

// The max number of listening Icecast clients allowed at a time.
// There's a limit because each connection invokes it's own instance of
// lame, oggenc, aacplusenc, etc. The HTTP Live Streaming is just a matter of
// serving regular static files, so those clients don't increment the count...
encoder.maxClients = maxClients = 15;

encoder.metadata = metadata = {};
encoder.currentTrack = currentTrack = "unknown";
var currentTrackStartTime, duration, dId;

//broadcasting client
app.use("/broadcast", express.static(__dirname + '/../public'));

//listen API route
app.use(encoder.Encoder('/listen', 'audio/mpeg', "lame", [
    "-S" // Operate silently (nothing to stderr)
  , "-r" // Input is raw PCM
  , "-s", encoder.SAMPLE_RATE / 1000 // Input sampling rate
  , "-"// Input from stdin
  , "-" // Output to stderr
  , "-V 5" //variable bit rate
]));

app.get('*', function(req, res) {
  res.sendFile(path.join(__dirname+ '/../src', 'index.html'));
});

app.listen(port);
console.log('Listening on port:' + port);

var server = binaryServer({
  port: 9001
});

server.on('connection', binarySocketHandler.connect);
