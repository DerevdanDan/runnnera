import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { MAX_PUNISHMENT_LENGTH } from "./league";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { buildDashboard } = await import("./league.server");
  return buildDashboard();
});

export const claimPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { getSessionAthleteId } = await import("./league.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const athleteId = await getSessionAthleteId();
    if (!athleteId) throw new Error("Please sign in with Strava first");

    const { data: already } = await supabaseAdmin
      .from("players")
      .select("id")
      .eq("athlete_id", athleteId)
      .maybeSingle();
    if (already) return { ok: true };

    const { data: claimed, error } = await supabaseAdmin
      .from("players")
      .update({ athlete_id: athleteId, claimed_at: new Date().toISOString() })
      .eq("id", data.playerId)
      .is("athlete_id", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claimed) throw new Error("That name was just taken — pick another");
    return { ok: true };
  });

export const addPunishment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ text: z.string().trim().min(1).max(MAX_PUNISHMENT_LENGTH) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requirePlayer } = await import("./league.server");
    const { canAddPunishment, monthKey } = await import("./league");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await requirePlayer();
    const month = monthKey(new Date());
    const { count } = await supabaseAdmin
      .from("punishments")
      .select("id", { count: "exact", head: true })
      .eq("player_id", me.id)
      .eq("month", month);
    if (!canAddPunishment(count ?? 0)) throw new Error("You already added 3 punishments this month");
    const { error } = await supabaseAdmin
      .from("punishments")
      .insert({ player_id: me.id, month, text: data.text });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePunishment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { requirePlayer } = await import("./league.server");
    const { monthKey } = await import("./league");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const me = await requirePlayer();
    const { error } = await supabaseAdmin
      .from("punishments")
      .delete()
      .eq("id", data.id)
      .eq("player_id", me.id)
      .eq("month", monthKey(new Date()));
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const spinWheel = createServerFn({ method: "POST" }).handler(async () => {
  const { spinForLastMonth } = await import("./league.server");
  return spinForLastMonth();
});

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { getAppSession } = await import("./session.server");
  const session = await getAppSession();
  await session.clear();
  return { ok: true };
});
