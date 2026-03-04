-- AlterTable
ALTER TABLE "public"."Player" ADD COLUMN     "draftOverall" INTEGER,
ADD COLUMN     "draftRound" INTEGER,
ADD COLUMN     "draftTeamId" TEXT,
ADD COLUMN     "draftYear" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Player" ADD CONSTRAINT "Player_draftTeamId_fkey" FOREIGN KEY ("draftTeamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;
