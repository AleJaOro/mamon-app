/* =========================================================
   CREDENCIALES DE FIREBASE
   =========================================================
   Reemplaza estos valores con los de TU proyecto de Firebase.
   Los obtienes en: Firebase Console > Configuración del proyecto
   > "Tus apps" > (ícono web </>) > Config.
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyA9LaPDk6YVA8ja3ybXbjtxXnXb2BePUvE",
  authDomain: "mamon-app-96efb.firebaseapp.com",
  projectId: "mamon-app-96efb",
  storageBucket: "mamon-app-96efb.firebasestorage.app",
  messagingSenderId: "213455518536",
  appId: "1:213455518536:web:d8cb85e6e898ca2793117d"
};

/* Nombre de la colección en Firestore donde se guardan los pedidos.
   Todos los que abran la app con este mismo archivo (y por lo tanto
   el mismo firebaseConfig) verán y editarán la MISMA colección. */
const COLECCION_PEDIDOS = "pedidos";

/* Inicialización (usa el SDK "compat" cargado en index.html) */
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();