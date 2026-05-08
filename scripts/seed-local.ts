import { resetState, getDataDir } from "../lib/store";

async function main() {
  const state = await resetState();
  console.log(`Seeded ${state.applications.length} applications in ${getDataDir()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
