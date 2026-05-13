import { NextResponse } from "next/server";
import { readState } from "@/lib/store";

export async function GET() {
  const state = await readState();
  return new NextResponse(`${JSON.stringify(state, null, 2)}\n`, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": "attachment; filename=\"careeros-local-state.json\"",
      "cache-control": "no-store"
    }
  });
}
