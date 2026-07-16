import { PageHeader } from "@/components/ui";
import { CalendarClient } from "@/components/CalendarClient";

export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="التقويم الزراعي" subtitle="جميع المصاريف والرواتب والمهام (ري، تسميد، رش، حصاد) في مكان واحد" />
      <CalendarClient />
    </div>
  );
}
