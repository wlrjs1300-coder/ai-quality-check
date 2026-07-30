import { notFound } from "next/navigation";

import { RuntimeValidationClient } from "./runtime-validation-client";

export default function RuntimeValidationPage() {
  if (process.env.RUNTIME_VALIDATION_ENABLED !== "true") {
    notFound();
  }

  return <RuntimeValidationClient />;
}
