const admin = require('firebase-admin');
const serviceAccount = require("../serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://codress-e5d1e.firebaseio.com"
});
const db = admin.firestore();

module.exports = { admin, db };

