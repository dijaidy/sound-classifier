// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from 'firebase/database';
import { getStorage } from "firebase/storage";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDJXpBQFkLQJPy-ocUHvnAB2sQZxbmIX3M",
  authDomain: "snu-engineer-contest.firebaseapp.com",
  databaseURL: "https://snu-engineer-contest-default-rtdb.firebaseio.com",
  projectId: "snu-engineer-contest",
  storageBucket: "snu-engineer-contest.firebasestorage.app",
  messagingSenderId: "992369721480",
  appId: "1:992369721480:web:4a744c2d23637057eadf3d",
  measurementId: "G-T626LQZKKF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const storage = getStorage(app);