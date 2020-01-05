const functions = require('firebase-functions');
const app = require('express')();
const cors = require('cors');
app.use(cors());


const { db } = require('./util/admin');

// users

const {
    signup
  } = require('./handlers/users');

// users routes
app.post('/signup', signup);

exports.api = functions.region('europe-west1').https.onRequest(app);
