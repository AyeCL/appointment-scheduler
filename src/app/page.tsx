import { Dashboard } from "@/components/dashboard/Dashboard";
import {
  createStaffAction,
  loadSampleScheduleAction,
  saveAvailabilityRangeAction,
  saveDateOverridesAction,
  saveWeeklyAvailabilityAction,
} from "./actions";
import { listAllDashboardData } from "@/db/queries";
import { mapStaffSchedule } from "@/lib/dashboard-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { staffSchedules, selectedStaffId } = await listAllDashboardData();

  return (
    <Dashboard
      schedules={staffSchedules.map(mapStaffSchedule)}
      selectedStaffId={selectedStaffId}
      createStaffAction={createStaffAction}
      loadSampleScheduleAction={loadSampleScheduleAction}
      saveAvailabilityRangeAction={saveAvailabilityRangeAction}
      saveWeeklyAvailabilityAction={saveWeeklyAvailabilityAction}
      saveDateOverridesAction={saveDateOverridesAction}
    />
  );
}
