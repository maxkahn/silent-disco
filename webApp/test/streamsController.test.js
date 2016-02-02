var request = require('supertest');
var express = require('express');
var chai = require('chai');
var expect = chai.expect;
//we have to turn the server off before testing
var app = require('../server/server.js');
var mongoose = require('mongoose');
var Stream = require('../server/streamsModel');
var User = require('../server/usersModel');
var controller = require('../server/streamsController');
var bodyParser = require('body-parser');

var dbURI = 'mongodb://localhost:27017/silentdisco';

// The `clearDB` helper function, when invoked, will clear the database
var clearDB = function (done) {
  mongoose.connection.collections['streams'].remove(done);
};

describe('Stream Controller', function () {

  // Connect to database before any tests
  before(function (done) {
    if (mongoose.connection.db) {
      return done();
    }
    mongoose.connect(dbURI, done)
  });

  beforeEach(function (done) {


    clearDB(function () {
      var streams = [
      ['muzak', {
        desc: 'what you hear in elevators',
        lat: 40,
        lng: 2,
        creator: 'John Doe'
      }],
      ['simon', {
        desc: 'after he left Garfunkel',
        lat: 40,
        lng: 2,
        creator: 'John Doe'
      }],
      ['electronica', {
        desc: 'something to dance to with a pacifier in your mouth',
        lat: 40,
        lng: 2,
        creator: 'John Doe'
      }],
      ['roommatetunes', {
        desc: 'not a roommate for long',
        lat: 40,
        lng: 2,
        creator: 'John Doe'
      }],
      ['baroqueopera', {
        desc: 'for the kind of people who like that sort of thing',
        lat: 40,
        lng: 2,
        creator: 'John Doe'
      }]
      ];

      for (var i = 0; i < streams.length; i++) {
        request(app)
        .post('/api/' + streams[i][0])
        .send(streams[i][1])
        .end(function(err, res) {
          if (err) {
            throw err;
          }
        });
      }
      done();
    });
});

it('should have a method that given a request to a name path, finds that stream in the database', function (done) {

  expect(controller.getStream).to.exist;

  var muzak = {
    desc: 'what you hear in elevators',
    lat: 40,
    lng: 2,
    creator: 'John Doe'
  };

  request(app)
  .post('/api/muzak')
  .send(muzak)
  .end(function(err, res) {
    expect(res.status).to.equal(201);
    request(app)
    .get('/api/listen/muzak')
    .set('Accept', 'application/json')
    .expect(function(res) {
      console.log(res.body);
    })
    .expect(200)
    .expect(function(res) {
      expect(res.body.name).to.equal('muzak');
      expect(res.body.description).to.equal('what you hear in elevators');
      expect(res.body.latitude).to.equal(40);
      expect(res.body.longitude).to.equal(2);

      expect(res.body.heartCountNum).to.equal(0);
      expect(res.body.listenerLiveCount).to.equal(0);
      expect(res.body.listenerMaxCount).to.equal(0);
      expect(res.body.creator).to.equal('56abed8eb64080841ec81823');
      expect(res.body.playing).to.equal(true);
    })
    .end(done);
  });



    // request(app)
    //   .get('/api/listen/arglebargle')
    //   .set('Accept', 'application/json')
    //   .expect(404, done);

  });

it('should have a method that given a stream object, adds that record to the database', function (done) {
  expect(controller.createStream).to.exist;


  var gospel = {
    desc: 'played twice-weekly in church',
    lat: 40,
    lng: 2,
    creator: 'John Doe'
  };

  request(app)
  .post('/api/gospel')
  .send(gospel)
  .end(function(err, res) {
    expect(res.status).to.equal(201);
    request(app)
    .get('/api/listen/gospel')
    .set('Accept', 'application/json')
    .expect(200)
    .expect(function(res) {
      expect(res.body.name).to.equal('gospel');
    })
    .end(done);
  });



});

  // });

it('should have a method that adds one heart to a given stream', function (done) {

  expect(controller.upHeart).to.exist;

  var muzak = {
    desc: 'what you hear in elevators',
    lat: 40,
    lng: 2,
    creator: 'John Doe'
  };

  request(app)
  .post('/api/muzak')
  .send(muzak)
  .end(function(err, res) {
    request(app)
    .put('/api/listen/muzak')
    .expect(200)
    .end(function(err, res) {
      if (err) {
        throw err;
      }
      else {
        request(app)
        .get('/api/listen/muzak')
        .expect(200)
        .expect(function (res) {
          expect(res.body.heartCountNum).to.be.above(0)
        })
        .end(done);
      }
    });
  });




});

it('should have a method that modifies the details of a given stream', function (done) {

  expect(controller.modifyStreamDetails).to.exist;

  var muzak = {
    desc: 'what you hear in elevators',
    lat: 40,
    lng: 2,
    creator: 'John Doe'
  };

  request(app)
  .post('/api/muzak')
  .send(muzak)
  .end(function(err, res) {
    request(app)
    .put('/api/broadcast/muzak')
    .send({desc: 'best music ever'})
    .expect(200)
    .end(function(err, res) {
      request(app)
      .get('/api/listen/muzak')
      .expect(200)
      .expect(function(res) {
        expect(res.body.description).to.equal('best music ever');
      })
      .end(done);
    });
  });

});

it('should have a method that responds to a GET request with all streams in the database', function (done) {

  expect(controller.getAllStreams).to.exist;

  request(app)
  .get('/api/streams')
  .set('Accept', 'application/json')
  .expect(200)
  .end(done);

});

});