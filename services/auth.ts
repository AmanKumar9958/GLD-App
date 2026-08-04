import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import Constants from "expo-constants";
import { supabase } from "./supabase";

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
      "Missing Google Web Client ID. Set expo.extra.googleWebClientId in app.json or EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID."
    );
  }

  GoogleSignin.configure({
    webClientId,
  });

  isGoogleConfigured = true;
}

export async function signInWithGoogle() {
  configureGoogleSignIn();

  try {
    await GoogleSignin.hasPlayServices({
      showPlayServicesUpdateDialog: true,
    });
  } catch {
    throw new Error(
      "Google Play Services is not available. Please update Google Play Services and try again."
    );
  }

  let signInResult;
  try {
    signInResult = await GoogleSignin.signIn();
  } catch (signInError: any) {
    const code = signInError?.code ?? signInError?.statusCode;

    if (code === "SIGN_IN_CANCELLED" || code === "12501") {
      throw new Error("Google sign-in was cancelled.");
    }
    if (code === "10" || code === "DEVELOPER_ERROR") {
      throw new Error(
        "Google sign-in configuration error. Please contact support."
      );
    }

    throw new Error("Google sign-in failed. Please try again.");
  }

  if (!isSuccessResponse(signInResult)) {
    throw new Error("Google sign-in was cancelled.");
  }

  const idToken = signInResult.data?.idToken;

  if (!idToken) {
    throw new Error("Google sign-in failed. Please try again.");
  }

  try {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });

    if (error) throw error;

    return data;
  } catch {
    throw new Error(
      "Unable to complete sign-in. Please check your internet connection and try again."
    );
  }
}

export async function signUpWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: pass,
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail(email: string, pass: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: pass,
  });

  if (error) throw error;
  return data;
}

export async function signOutCurrentUser() {
  try {
    configureGoogleSignIn();
    await GoogleSignin.signOut();
  } catch {
    // Ignore Google sign-out errors
  }

  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
