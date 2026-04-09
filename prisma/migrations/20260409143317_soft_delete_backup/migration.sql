-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "BillingEntry" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ClinicalImage" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Professional" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Treatment" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Appointment_deletedAt_idx" ON "Appointment"("deletedAt");

-- CreateIndex
CREATE INDEX "BillingEntry_deletedAt_idx" ON "BillingEntry"("deletedAt");

-- CreateIndex
CREATE INDEX "ClinicalImage_deletedAt_idx" ON "ClinicalImage"("deletedAt");

-- CreateIndex
CREATE INDEX "Patient_deletedAt_idx" ON "Patient"("deletedAt");

-- CreateIndex
CREATE INDEX "Professional_deletedAt_idx" ON "Professional"("deletedAt");

-- CreateIndex
CREATE INDEX "Treatment_deletedAt_idx" ON "Treatment"("deletedAt");
