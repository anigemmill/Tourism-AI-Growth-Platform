import { ActionForm, Card, PageHeader, TextArea } from "@/components/ui";
import { requirePermission } from "@/lib/auth/session";
import { createAsset } from "../actions";
import { AssetFields } from "../AssetFields";

export default async function NewAssetPage() {
  await requirePermission("library.edit");
  return (
    <div>
      <PageHeader eyebrow="Agent & workflow library" title="Add to library" />
      <Card>
        <ActionForm action={createAsset} submitLabel="Create">
          <AssetFields />
          <TextArea name="instructions" label="Instructions / prompt / specification (v1)" required rows={8} />
        </ActionForm>
      </Card>
    </div>
  );
}
