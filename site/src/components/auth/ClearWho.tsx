"use client";
import { useEffect } from "react";
import { WHO_COOKIE } from "@/lib/auth-shared";

/** On the login page without a valid session: forget the greeting cookie, so no header shows an old name. */
export default function ClearWho() {
  useEffect(() => {
    if (document.cookie.includes(`${WHO_COOKIE}=`)) document.cookie = `${WHO_COOKIE}=; Max-Age=0; path=/; samesite=lax`;
  }, []);
  return null;
}
