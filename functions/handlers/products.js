const { db } = require("../util/admin");

exports.getAllProducts = (req, res) => {
  db.collection("products")
    // .orderBy("createdAt", desc)
    .get()
    .then(data => {
      let products = [];
      data.forEach(doc => {
        products.push({
          productId: doc.id,
          body: doc.data().body,
          userHandle: doc.data().userHandle,
          createdAt: doc.data().createdAt,
          commentCount: doc.data().commentCount,
          likedCount: doc.data().likedCount,
          productImage: doc.data().productImage
        });
      });
      return res.json(products);
    })
    .catch(error => {
      console.error(error);
      res.status(500).json({ error: error.code });
    });
};

const convertCollectionsSnapshotToMap = collections => {
  const transformedCollection = collections.docs.map(doc => {
    const { title, items } = doc.data();

    return {
      routeName: encodeURI(title.toLowerCase()),
      id: doc.id,
      title,
      items
    };
  });

  return transformedCollection.reduce((accumulator, collection) => {
    accumulator[collection.title.toLowerCase()] = collection;
    return accumulator;
  }, {});
};
exports.getAllCollections = (req, res) => {
  const collectionRef = db.collection('collections');
  collectionRef
    // .orderBy("createdAt", desc)
    .get()
    .then(snapshot => {
      const collectionsMap = convertCollectionsSnapshotToMap(snapshot);
      console.log(collectionsMap)
      // let products = [];
      // data.forEach(doc => {
      //   products.push({
      //     productId: doc.id,
      //     body: doc.data().body,
      //     userHandle: doc.data().userHandle,
      //     createdAt: doc.data().createdAt,
      //     commentCount: doc.data().commentCount,
      //     likedCount: doc.data().likedCount,
      //     productImage: doc.data().productImage
      //   });
      // });
      return res.json(collectionsMap);
    })
    .catch(error => {
      console.error(error);
      res.status(500).json({ error: error.code });
    });
};
exports.postOneProduct = (req, res) => {
  if (req.body.description.trim() === "") {
    return res.status(400).json({ body: "Body must not be empty" });
  }
  const newProduct = {
    name: req.body.name,
    userHandle: req.body.userHandle,
    productImage: req.body.imageUrl,
    price: req.body.price,
    createdAt: new Date().toISOString(),
    likedCount: 0,
    commentCount: 0
  };
  db.collection("products")
    .add(newProduct)
    .then(doc => {
      const resProduct = newProduct;
      resProduct.productId = doc.id;
      res.json(resProduct);
    })
    .catch(err => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
};

// Fetch one product
exports.getProduct = (req, res) => {
  let productData = {};
  db.doc(`/products/${req.params.productId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Product not found" });
      }
      productData = doc.data();
      productData.productId = doc.id;
      return db
        .collection("products")
        // .orderBy("createdAt", "desc")
        .where("productId", "==", req.params.productId)
        .get();
    })
    .then(data => {
      productData.comments = [];
      data.forEach(doc => {
        productData.comments.push(doc.data());
      });
      return res.json(productData);
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Comment on a comment
exports.commentOnProduct = (req, res) => {
  if (req.body.description.trim() === "")
    return res.status(400).json({ comment: "Must not be empty" });

  const newComment = {
    description: req.body.description,
    createdAt: new Date().toISOString(),
    productId: req.params.productId,
    userHandle: req.user.userHandle,
    productImage: req.user.imageUrl
  };
  db.doc(`/products/${req.params.productId}`)
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Product not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      return db.collection("comments").add(newComment);
    })
    .then(() => {
      res.json(newComment);
    })
    .catch(err => {
      console.log(err);
      res.status(500).json({ error: "Something went wrong" });
    });
};
// Like a scream
exports.likeProduct = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.userHandle)
    .where("productId", "==", req.params.productId)
    .limit(1);

  const productDocument = db.doc(`/products/${req.params.productId}`);

  let productData;

  productDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        productData = doc.data();
        productData.productId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Product not found" });
      }
    })
    .then(data => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            productId: req.params.productId,
            userHandle: req.user.userHandle
          })
          .then(() => {
            productData.likeCount++;
            return productDocument.update({ likeCount: productData.likeCount });
          })
          .then(() => {
            return res.json(productData);
          });
      } else {
        return res.status(400).json({ error: "Product already liked" });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeProduct = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.userHandle)
    .where("productId", "==", req.params.productId)
    .limit(1);

  const productDocument = db.doc(`/products/${req.params.productId}`);

  let productData;

  productDocument
    .get()
    .then(doc => {
      if (doc.exists) {
        productData = doc.data();
        productData.productId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(404).json({ error: "Product not found" });
      }
    })
    .then(data => {
      if (data.empty) {
        return res.status(400).json({ error: "Product not liked" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            productData.likeCount--;
            return productDocument.update({ likeCount: productData.likeCount });
          })
          .then(() => {
            res.json(productData);
          });
      }
    })
    .catch(err => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};
// Delete a scream
exports.deleteProduct = (req, res) => {
  const document = db.doc(`/products/${req.params.productId}`);
  document
    .get()
    .then(doc => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Product not found" });
      }
      if (doc.data().userHandle !== req.user.userHandle) {
        return res.status(403).json({ error: "Unauthorized" });
      } else {
        return document.delete();
      }
    })
    .then(() => {
      res.json({ message: "Product deleted successfully" });
    })
    .catch(err => {
      console.error(err);
      return res.status(500).json({ error: err.code });
    });
};
// Upload a profile product
exports.uploadImage = (req, res) => {
  const BusBoy = require("busboy");
  const path = require("path");
  const os = require("os");
  const fs = require("fs");

  const busboy = new BusBoy({ headers: req.headers });

  let imageToBeUploaded = {};
  let imageFileName;

  busboy.on("file", (fieldname, file, filename, encoding, mimetype) => {
    console.log(fieldname, file, filename, encoding, mimetype);
    if (mimetype !== "image/jpeg" && mimetype !== "image/png") {
      return res.status(400).json({ error: "Wrong file type submitted" });
    }
    // my.image.png => ['my', 'image', 'png']
    const imageExtension = filename.split(".")[filename.split(".").length - 1];
    // 32756238461724837.png
    imageFileName = `${Math.round(
      Math.random() * 1000000000000
    ).toString()}.${imageExtension}`;
    const filepath = path.join(os.tmpdir(), imageFileName);
    imageToBeUploaded = { filepath, mimetype };
    file.pipe(fs.createWriteStream(filepath));
  });
  busboy.on("finish", () => {
    admin
      .storage()
      .bucket()
      .upload(imageToBeUploaded.filepath, {
        resumable: false,
        metadata: {
          metadata: {
            contentType: imageToBeUploaded.mimetype
          }
        }
      })
      .then(() => {
        const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imageFileName}?alt=media`;
        return db.doc(`/products/${req.params.productId}`).update({ imageUrl });
      })
      .then(() => {
        return res.json({ message: "image uploaded successfully" });
      })
      .catch(err => {
        console.error(err);
        return res.status(500).json({ error: "something went wrong" });
      });
  });
  busboy.end(req.rawBody);
};
