"use client";
import { startTransition } from "react";

/**
 * Runs a form's server action without React's automatic form reset, so a failed attempt keeps
 * what the person typed (a wrong password should not empty the email field). Forms that should
 * clear after success call form.reset() themselves.
 */
export function keepValues(run: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const fd = submitter && submitter.getAttribute("form") === null ? new FormData(e.currentTarget, submitter) : new FormData(e.currentTarget);
    startTransition(() => run(fd));
  };
}
