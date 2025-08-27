"use client";

import React from "react";
import { auth, googleProvider } from "../lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { toast } from "react-toastify";
import { API_BASE_URL } from "../utils/api";

type AuthMode = "signup" | "signin";

type LoginModalProps = {
  isVisible: boolean;
  mode: AuthMode;
  nameRef: React.RefObject<HTMLInputElement>;
  emailRef: React.RefObject<HTMLInputElement>;
  passwordRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onAuth: () => Promise<void>;
  toggleMode: () => void;
};

// 🔐 Frontend key helper (adds X-Frontend-Key to requests)
const FRONTEND_KEY = (process.env.NEXT_PUBLIC_FRONTEND_KEY || "").trim();
const withFrontendKey = (init: RequestInit = {}): RequestInit => {
  const headers = new Headers(init.headers || {});
  headers.set("X-Frontend-Key", FRONTEND_KEY);
  return { ...init, headers };
};

const LoginModal: React.FC<LoginModalProps> = ({
  isVisible,
  mode,
  nameRef,
  emailRef,
  passwordRef,
  onClose,
  onAuth,
  toggleMode,
}) => {
  if (!isVisible) return null;
  const isSignup = mode === "signup";

  const saveUserToBackend = async ({
    user_id,
    email,
    password,
    name,
  }: {
    user_id: string;
    email: string;
    password: string;
    name: string;
  }) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/save-user/`,
        withFrontendKey({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id, email, password, name }),
        })
      );
      const data = await response.json();

      if (!response.ok && data?.error?.includes("unique")) {
        throw new Error("Email already exists.");
      }
    } catch (err) {
      console.error("Backend save error:", err);
      throw err;
    }
  };

  const saveUserToFirestore = async ({
    user_id,
    name,
    email,
  }: {
    user_id: string;
    name: string;
    email: string;
  }) => {
    try {
      await setDoc(doc(db, "users", user_id), {
        username: name,
        email,
        createdAt: new Date(),
      });
    } catch (err) {
      console.error("Firestore save error:", err);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const name = result.user.displayName || "Google User";
      const email = result.user.email || "";
      const user_id = result.user.uid;

      await saveUserToBackend({ user_id, email, name, password: "" });
      await saveUserToFirestore({ user_id, name, email });

      toast.success(`Welcome ${name}!`);
      onClose();
    } catch (error) {
      toast.error("Google sign-in failed. Please try again.");
      console.error("Google sign-in error:", error);
    }
  };

  const handleAuth = async () => {
    const name = nameRef.current?.value || "";
    const email = emailRef.current?.value || "";
    const password = passwordRef.current?.value || "";

    const isSignup = mode === "signup";

    try {
      let userId = "";

      if (isSignup) {
        try {
          const result = await createUserWithEmailAndPassword(auth, email, password);
          userId = result.user.uid;

          await saveUserToFirestore({ user_id: userId, name, email });
        } catch (firebaseError) {
          console.warn("Firebase signup failed. Continuing with backend fallback...");
        }

        const usersRes = await fetch(
          `${API_BASE_URL}/api/show-user/`,
          withFrontendKey()
        );
        const usersData = await usersRes.json();
        const existingUser = usersData.users.find((u: any) => u.email === email);

        if (existingUser) {
          toast.error("Email already exists. Please sign in.");
          throw new Error("Duplicate email");
        }

        await saveUserToBackend({
          user_id: userId || `local-${Date.now()}`,
          email,
          password,
          name,
        });

        toast.success("Account created!");
        onClose();
      } else {
        try {
          const result = await signInWithEmailAndPassword(auth, email, password);
          toast.success(`Signed in as ${result.user.displayName || result.user.email}`);
          onClose();
        } catch (firebaseLoginError) {
          console.warn("Firebase sign-in failed. Trying backend...");

          const usersRes = await fetch(
            `${API_BASE_URL}/api/show-user/`,
            withFrontendKey()
          );
          const usersData = await usersRes.json();
          const matchedUser = usersData.users.find((u: any) => u.email === email);

          if (!matchedUser) {
            toast.error("User not found.");
            throw new Error("User not found");
          }

          toast.success(`Signed in as ${matchedUser.first_name || matchedUser.email}`);
          onClose();
        }
      }
    } catch (error) {
      console.error("Auth error:", error);
      toast.error(isSignup ? "Sign-up failed." : "Sign-in failed.");
    }
  };

  const inputClass = (active: boolean) =>
    `w-full p-3 border rounded-md focus:outline-none focus:ring-2 mb-2 ${
      active
        ? "text-white placeholder-white border-white bg-transparent md:text-black md:placeholder-gray-500 md:border-gray-300 md:bg-white"
        : "text-black placeholder-gray-500 border-gray-300 bg-white"
    }`;

  return (
    <div
      id="authModal"
      style={{ fontFamily: "var(--font-poppins), Arial, Helvetica, sans-serif" }}
      className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={(e) => {
        if ((e.target as HTMLElement).id === "authModal") onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-heading"
    >
      <div className="w-full max-w-[860px] rounded-[20px] overflow-hidden bg-white flex flex-col md:flex-row shadow-[0_0_30px_rgba(0,0,0,0.2)]">
        {/* Left Panel */}
        <div className="hidden md:flex md:flex-1 bg-[#891f1a] text-white p-10 flex-col justify-center items-center text-center">
          {/* h2 → Semi Bold (600) */}
          <h2 id="auth-heading" className="text-[26px] font-semibold mb-5">
            {isSignup ? "Welcome Back!" : "Hello, Friend!"}
          </h2>
          {/* p → Regular (400) */}
          <p className="text-sm font-normal mb-5">
            {isSignup
              ? "To keep connected with us please login with your personal info"
              : "Enter your personal details and start your journey with us"}
          </p>
          {/* button → Medium (500) */}
          <button
            onClick={toggleMode}
            className="bg-white text-black font-medium px-6 py-3 rounded-full text-base"
          >
            {isSignup ? "SIGN IN" : "SIGN UP"}
          </button>
        </div>

        {/* Right Panel */}
        <div
          className={`md:flex-1 p-6 md:p-10 flex flex-col justify-center items-center text-center w-full ${
            isSignup
              ? "bg-[#891f1a] text-white md:bg-white md:text-black"
              : "bg-white text-black"
          }`}
        >
          {/* h2 → Semi Bold (600) */}
          <h2 className="text-[22px] md:text-[26px] font-semibold mb-4 md:mb-5">
            {isSignup ? "Create Account 🚀" : "Sign In 👋"}
          </h2>
          {/* p → Regular (400) */}
          <p className="text-sm font-normal mb-4 md:mb-5">
            {isSignup
              ? "or use your email for registration"
              : "or use your account"}
          </p>

          {isSignup && (
            <input
              ref={nameRef}
              type="text"
              placeholder="🧑 Name"
              className={inputClass(isSignup)}
              aria-label="Name"
            />
          )}

          <input
            ref={emailRef}
            type="email"
            placeholder="📧 Email"
            className={inputClass(isSignup)}
            aria-label="Email"
            autoComplete="email"
          />

          <input
            ref={passwordRef}
            type="password"
            placeholder="🔐 Password"
            className={`${inputClass(isSignup)} mb-4`}
            aria-label="Password"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          {!isSignup && (
            <button
              onClick={handleGoogleLogin}
              className="cursor-pointer flex items-center justify-center gap-2 w-full px-4 py-3 mb-4 border border-gray-300 rounded-full hover:bg-gray-100 transition font-medium"
              aria-label="Sign in with Google"
            >
              <img
                src="/images/google.svg"
                alt="Google"
                className="w-5 h-5"
                loading="lazy"
                width={20}
                height={20}
                onError={(e) => {
                  e.currentTarget.src = "/images/default.jpg";
                }}
              />
              {/* span → Regular (400) */}
              <span className="text-sm font-normal text-black">
                Sign in with Google
              </span>
            </button>
          )}

          {/* button → Medium (500) */}
          <button
            onClick={handleAuth}
            className="bg-[#ff5858] hover:bg-[#e94b4b] transition text-white font-medium px-6 py-3 rounded-full text-base mb-3 w-full"
          >
            {isSignup ? "SIGN UP" : "SIGN IN"}
          </button>

          <button
            onClick={toggleMode}
            className="bg-white text-black font-medium px-6 py-3 rounded-full text-sm md:text-base block md:hidden"
          >
            {isSignup
              ? "Already have an account? SIGN IN"
              : "Don't have an account? SIGN UP"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
