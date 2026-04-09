// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyA7KmmSAxSzNl6Rsw-PHTzP_EzX9OsgmL8",
    authDomain: "signed-terms-world-map.firebaseapp.com",
    projectId: "signed-terms-world-map",
    storageBucket: "signed-terms-world-map.firebasestorage.app",
    messagingSenderId: "390657009492",
    appId: "1:390657009492:web:1b45a6ba2eb4dbcc7b8ac1",
    measurementId: "G-X5EE0DNQBW"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence for faster initial loads
db.enablePersistence()
  .catch(function(err) {
      if (err.code == 'failed-precondition') {
          console.warn("Multiple tabs open, persistence can only be enabled in one tab at a a time.");
      } else if (err.code == 'unimplemented') {
          console.warn("The current browser does not support all of the features required to enable persistence");
      }
  });
