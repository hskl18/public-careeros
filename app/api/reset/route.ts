import { NextResponse } from "next/server";
import { rejectUnsafeLocalMutation } from "@/lib/api-security";
import { resetState } from "@/lib/store";

export async function POST(request: Request) {
  const unsafe = rejectUnsafeLocalMutation(request);
  if (unsafe) return unsafe;

  await resetState();
  return NextResponse.redirect(new URL("/", request.url), 303);
}
