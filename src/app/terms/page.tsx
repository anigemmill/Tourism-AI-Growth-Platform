import { LegalPage, legalMetadata } from "@/components/LegalPage";

export const metadata = legalMetadata("terms");

export default function Page() {
  return <LegalPage id="terms" />;
}
