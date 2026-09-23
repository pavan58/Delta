import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type z, type ZodTypeAny } from "zod";
import { ContextSchema } from "./validation";
import type { FitFeedback, SizeMapEntry, UserProfile, WardrobeItem } from "../types";

export interface PersonalContext {
  profile: UserProfile | null;
  feedback: FitFeedback[];
  sizeMap: SizeMapEntry[];
  wardrobe: WardrobeItem[];
}

export async function readBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.output<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw new HttpError(400, `Invalid request: ${r.error.issues[0]?.path.join(".")} ${r.error.issues[0]?.message}`);
  return r.data;
}

export function personal(ctx: unknown): PersonalContext {
  const c = ContextSchema.parse(ctx ?? {});
  return { profile: (c.profile ?? null) as UserProfile | null, feedback: c.feedback ?? [], sizeMap: c.sizeMap ?? [], wardrobe: (c.wardrobe ?? []) as WardrobeItem[] };
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function handle(fn: (req: Request, params: Record<string, string>) => Promise<unknown>) {
  return async (req: Request, ctx: { params: Promise<Record<string, string>> }) => {
    try {
      const data = await fn(req, ctx?.params ? await ctx.params : {});
      return data instanceof Response ? data : NextResponse.json(data);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: `Invalid request: ${e.issues[0]?.path.join(".")} ${e.issues[0]?.message}` }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: "Something went wrong on our side. Please retry." }, { status: 500 });
    }
  };
}

export function publicRecipe(r: { id: string; name: string; description: string; slots: { key: string; label: string; slot: string; hint: string; optional?: boolean; categories: string[] }[] }) {
  return { id: r.id, name: r.name, description: r.description, slots: r.slots.map(({ key, label, slot, hint, optional, categories }) => ({ key, label, slot, hint, optional: !!optional, categories })) };
}
