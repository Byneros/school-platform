CREATE TYPE "CoexistenceProtocol" AS ENUM ('TIPO_I', 'TIPO_II', 'TIPO_III');

ALTER TABLE "StudentObservation" ADD COLUMN "coexistenceProtocol" "CoexistenceProtocol";
