import { NextResponse } from "next/server";
import { resetState } from "@/lib/store";

export async function POST(request: Request) {
  await resetState();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
