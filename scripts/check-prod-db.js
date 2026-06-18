// READ-ONLY production DB inspection. Changes nothing.
// Usage (PowerShell, from the repo root):
//   $env:DATABASE_URL="<your-neon-connection-string>"
//   node scripts/check-prod-db.js
const { Client } = require("pg");

(async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Set DATABASE_URL to the Neon connection string first.");
    process.exit(1);
  }
  const c = new Client({ connectionString: url });
  await c.connect();

  const hasCol = await c.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name='Application' AND column_name='ticketsAccessToken'"
  );
  const hasTicket = await c.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name='Ticket'"
  );
  const hasMigTable = await c.query(
    "SELECT 1 FROM information_schema.tables WHERE table_name='_prisma_migrations'"
  );

  console.log("ticketsAccessToken column on Application:", hasCol.rowCount === 1 ? "PRESENT" : "MISSING");
  console.log("Ticket table:", hasTicket.rowCount === 1 ? "PRESENT" : "MISSING");
  console.log("_prisma_migrations table:", hasMigTable.rowCount === 1 ? "PRESENT" : "MISSING");

  if (hasMigTable.rowCount === 1) {
    const migs = await c.query(
      "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at"
    );
    console.log("\nRecorded migrations:");
    for (const m of migs.rows) {
      console.log(`  ${m.finished_at ? "[applied]" : "[PENDING/FAILED]"} ${m.migration_name}`);
    }
  } else {
    console.log("\nNo _prisma_migrations table -> prod was likely set up with `db push`, not `migrate deploy`.");
  }

  await c.end();
})().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
