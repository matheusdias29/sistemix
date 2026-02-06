import { initializeApp } from 'firebase/app'
import { initializeFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getAuth, signInAnonymously } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MSG_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
}

const app = initializeApp(firebaseConfig)
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  useFetchStreams: false,
  ignoreUndefinedProperties: true,
}, "sistemix")
export const storage = getStorage(app)

// Auth: realiza login anônimo automático para cumprir regras que exigem request.auth
export const auth = getAuth(app)
try {
  signInAnonymously(auth)
    .then(() => {
      console.info('Autenticação anônima ativa')
    })
    .catch((err) => {
      // Se o provedor Anonymous estiver desativado, não quebra o app; apenas avisa
      console.warn('Falha no login anônimo:', err?.code || err?.message)
    })
} catch (e) {
  console.warn('Erro inesperado ao iniciar login anônimo:', e?.message)
}
