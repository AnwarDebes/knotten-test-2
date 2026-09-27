"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth-shared";

/** Signing in is the shared preview sign-in (it opens the portal); signing out here stays in Klassisk. */
export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/logg-inn");
}
