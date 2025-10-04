"use client";
import { Suspense } from "react";
import DiagramViewer from "@/components/diagrams/DiagramViewer";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

export default function DiagramPage() {
  return (
    <Suspense fallback={<LoadingSpinner message="Loading diagram..." />}>
      <DiagramViewer />
    </Suspense>
  );
}
