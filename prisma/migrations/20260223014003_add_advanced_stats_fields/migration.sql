-- AlterTable
ALTER TABLE "public"."AdvancedStats" ADD COLUMN     "fiveOnFiveTOIPerGP" DECIMAL(6,2),
ADD COLUMN     "goalsPer60" DECIMAL(6,2),
ADD COLUMN     "penaltyDifferential" INTEGER,
ADD COLUMN     "pkTOIPerGP" DECIMAL(6,2),
ADD COLUMN     "pointsPer60" DECIMAL(6,2),
ADD COLUMN     "ppTOIPerGP" DECIMAL(6,2);
