DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "School"
    WHERE "nit" IS NOT NULL
    GROUP BY "nit"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Cannot add unique School.nit constraint while duplicate NIT values exist.';
  END IF;
END $$;

CREATE UNIQUE INDEX "School_nit_key" ON "School"("nit");
