const initUser = require('./init-user');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({
  origin: true
});

admin.initializeApp(functions.config().firebase);
const ref = admin.database().ref();

exports.initUser = functions.auth.user().onCreate(event => {
  initUser.handler(admin, ref, event);
});