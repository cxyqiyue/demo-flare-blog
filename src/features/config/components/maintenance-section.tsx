import { CacheMaintenance } from "@/features/cache/components/cache-maintenance";
import { BackupRestoreSection } from "@/features/import-export/components/backup-restore-section";
import { SearchMaintenance } from "@/features/search/components/search-maintenance";
import { VersionMaintenance } from "@/features/version/components/version-maintenance";
import { isFuwari } from "@/lib/theme-mode";

export function MaintenanceSection() {
  if (isFuwari) {
    return (
      <div className="flex flex-col gap-4">
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 bg-(--fuwari-card-bg) fuwari-onload-animation">
          <VersionMaintenance />
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="fuwari-card-base p-4 sm:p-5 md:p-6 bg-(--fuwari-card-bg) fuwari-onload-animation">
            <SearchMaintenance />
          </div>
          <div className="fuwari-card-base p-4 sm:p-5 md:p-6 bg-(--fuwari-card-bg) fuwari-onload-animation">
            <CacheMaintenance />
          </div>
        </div>
        <div className="fuwari-card-base p-4 sm:p-5 md:p-6 bg-(--fuwari-card-bg) fuwari-onload-animation">
          <BackupRestoreSection />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">
      <section className="border border-border/30 bg-background/50 p-8">
        <VersionMaintenance />
      </section>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-10">
        <SearchMaintenance />
        <CacheMaintenance />
      </div>

      <div className="pt-4 border-t border-border/20">
        <BackupRestoreSection />
      </div>
    </div>
  );
}
