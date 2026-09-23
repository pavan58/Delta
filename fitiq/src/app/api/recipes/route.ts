import { RECIPES } from "@/lib/engines/recipes";
import { publicRecipe } from "@/lib/server/route-utils";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ recipes: RECIPES.map((r) => ({ ...publicRecipe(r), styles: r.styles, occasions: r.occasions })) });
}
