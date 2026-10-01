"use client";
import { createContext, useContext } from "react";

/** Set while an administrator views the portal as someone else; the label of who. */
export const PreviewContext = createContext<string | undefined>(undefined);
export const usePreview = () => useContext(PreviewContext);
