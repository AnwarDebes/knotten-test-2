import type { Metadata } from "next";
import PlotStage from "@/components/klassisk/PlotStage";

export const metadata: Metadata = { title: "Tomtene", description: "Tomtevelger for Knotten: 30 tomter i fire rekker, alle planlagt med sjøutsikt." };

export default function Tomtene() {
  return <PlotStage />;
}
