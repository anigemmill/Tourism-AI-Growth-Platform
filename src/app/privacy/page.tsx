import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata("privacy");

export default function Page() {
  return <LegalPage id="privacy" />;
}
