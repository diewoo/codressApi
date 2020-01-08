const functions = require('firebase-functions');
const app = require('express')();
const cors = require('cors');
const FBAuth = require('./util/fbAuth');
app.use(cors());


const { db } = require('./util/admin');

const {
  getAllProducts,
  postOneProduct,
  getProduct,
  commentOnProduct,
  likeProduct,
  unlikeProduct,
  getAllCollections,
  deleteProduct,
  uploadImage
} = require('./handlers/products');
// users

const {
    signup,
    login,
    addUserDetails,
    getAuthenticatedUser,
    getUserDetails,
    markNotificationsRead,
    deleteUser
  } = require('./handlers/users');

// Product routes
app.get('/products', getAllProducts);
app.get('/collections', getAllCollections);
app.post('/product', postOneProduct);
app.post('/product/image', FBAuth, uploadImage);
app.get('/product/:productId', getProduct);
app.delete('/product/:productId', FBAuth, deleteProduct);
app.get('/product/:productId/like', FBAuth, likeProduct);
app.get('/product/:productId/unlike', FBAuth, unlikeProduct);
app.post('/product/:productId/comment', FBAuth, commentOnProduct);

// users routes
app.post('/signup', signup);
app.delete('/user/:userId', deleteUser);
app.post('/login', login);
app.post('/user', FBAuth, addUserDetails);
app.get('/user', FBAuth, getAuthenticatedUser);
app.get('/user/:handle', getUserDetails);
app.post('/notifications', FBAuth, markNotificationsRead);

exports.api = functions.region('europe-west1').https.onRequest(app);
exports.createNotificationOnLike = functions
  .region('europe-west1')
  .firestore.document('likes/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/products/${snapshot.data().productId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'like',
            read: false,
            productId: doc.id
          });
        }
      })
      .catch((err) => console.error(err));
  });
exports.deleteNotificationOnUnLike = functions
  .region('europe-west1')
  .firestore.document('likes/{id}')
  .onDelete((snapshot) => {
    return db
      .doc(`/notifications/${snapshot.id}`)
      .delete()
      .catch((err) => {
        console.error(err);
        return;
      });
  });
exports.createNotificationOnComment = functions
  .region('europe-west1')
  .firestore.document('comments/{id}')
  .onCreate((snapshot) => {
    return db
      .doc(`/products/${snapshot.data().productId}`)
      .get()
      .then((doc) => {
        if (
          doc.exists &&
          doc.data().userHandle !== snapshot.data().userHandle
        ) {
          return db.doc(`/notifications/${snapshot.id}`).set({
            createdAt: new Date().toISOString(),
            recipient: doc.data().userHandle,
            sender: snapshot.data().userHandle,
            type: 'comment',
            read: false,
            productId: doc.id
          });
        }
      })
      .catch((err) => {
        console.error(err);
        return;
      });
  });

exports.onProductImageChange = functions
  .region('europe-west1')
  .firestore.document('/users/{userId}')
  .onUpdate((change) => {
    console.log(change.before.data());
    console.log(change.after.data());
    if (change.before.data().imageUrl !== change.after.data().imageUrl) {
      console.log('image has changed');
      const batch = db.batch();
      return db
        .collection('products')
        .where('userHandle', '==', change.before.data().handle)
        .get()
        .then((data) => {
          data.forEach((doc) => {
            const scream = db.doc(`/products/${doc.id}`);
            batch.update(scream, { productImage: change.after.data().imageUrl });
          });
          return batch.commit();
        });
    } else return true;
  });

exports.onProductDelete = functions
  .region('europe-west1')
  .firestore.document('/products/{productId}')
  .onDelete((snapshot, context) => {
    const productId = context.params.productId;
    const batch = db.batch();
    return db
      .collection('comments')
      .where('productId', '==', productId)
      .get()
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/comments/${doc.id}`));
        });
        return db
          .collection('likes')
          .where('productId', '==', productId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/likes/${doc.id}`));
        });
        return db
          .collection('notifications')
          .where('productId', '==', productId)
          .get();
      })
      .then((data) => {
        data.forEach((doc) => {
          batch.delete(db.doc(`/notifications/${doc.id}`));
        });
        return batch.commit();
      })
      .catch((err) => console.error(err));
  });