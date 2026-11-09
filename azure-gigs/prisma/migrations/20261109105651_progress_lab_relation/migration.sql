-- AddForeignKey
ALTER TABLE "UserProgress" ADD CONSTRAINT "UserProgress_labId_fkey" FOREIGN KEY ("labId") REFERENCES "Lab"("id") ON DELETE CASCADE ON UPDATE CASCADE;
