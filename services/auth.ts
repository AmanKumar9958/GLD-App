import {
    getAuth,
    GoogleAuthProvider,
    signInWithCredential,
    signOut,
} from "@react-native-firebase/auth";
import {
    collection,
    doc,
    getFirestore,
    serverTimestamp,
    setDoc,
} from "@react-native-firebase/firestore";
import {
    GoogleSignin,
    isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";
import { saveUserProfile } from "./userProfile";

let isGoogleConfigured = false;

function getGoogleWebClientId(): string {
  const extra = Constants.expoConfig?.extra as
    | { googleWebClientId?: string }
    | undefined;

  const appJsonValue = extra?.googleWebClientId?.trim();
  const envValue = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();

  return appJsonValue || envValue || "";
}

function configureGoogleSignIn(): void {
  if (isGoogleConfigured) {
    return;
  }

  const webClientId = getGoogleWebClientId();

  if (!webClientId) {
    throw new Error(
      "Missing Google Web Client ID. Set expo.extra.googleWebClientId in app.json or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.",
    );
  }

  GoogleSignin.configure({
    webClientId,
  });

  isGoogleConfigured = true;
}

async function persistSignedInUserProfile(user: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<void> {
  const db = getFirestore();
  const userRef = doc(collection(db, "users"), user.uid);

  await setDoc(
    userRef,
    {
      uid: user.uid,
      name: user.displayName || "User",
      email: user.email,
      photoURL: user.photoURL,
      lastLoginAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function signInWithGoogle() {
  configureGoogleSignIn();

  await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });

  const signInResult = await GoogleSignin.signIn();

  if (!isSuccessResponse(signInResult)) {
    throw new Error("Google sign-in was cancelled.");
  }

  const idToken = signInResult.data?.idToken;

  if (!idToken) {
    throw new Error("Google sign-in did not return an ID token.");
  }

  const googleCredential = GoogleAuthProvider.credential(idToken);
  return getAuth().signInWithCredential(googleCredential);
}

export async function signOutCurrentUser() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out errors and still sign out from Firebase.
  }

  return getAuth().signOut();
}
