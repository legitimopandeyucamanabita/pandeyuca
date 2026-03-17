import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDVc_G_0LlsqqSaMGzucebnUnUqszOoZcs",
  databaseURL: "https://pan-de-yuca-default-rtdb.firebaseio.com",
  projectId: "pan-de-yuca",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getDatabase(app);
