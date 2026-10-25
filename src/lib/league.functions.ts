import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_PUNISHMENT_LENGTH } from "./league";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { buildDashboard } = await import("./league.server");
  return buildDashboard();
});

/**
 * Called right after Google sign-in. Signs straight in if this Google account already owns a name,
 * otherwise returns the names nobody has claimed yet so the person can pick theirs.
 */
export const linkGoogleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, startSession } = await import("./league.server");
    const db = await admin();
    const { data: mine } = await db.from("players").select("id").eq("user_id", context.userId).maybeSingle();
    if (mine) {
      await startSession(mine.id, context.userId);
      return { status: "signed_in" as const, unclaimed: [] };
    }
    const { data: unclaimed } = await db.from("players").select("id, name").is("user_id", null).order("name");
    return { status: "pick" as const, unclaimed: unclaimed ?? [] };
  });

export const claimPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ playerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, startSession } = await import("./league.server");
    const db = await admin();
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const { data: claimed, error } = await db
      .from("players")
      .update({ user_id: context.userId, email, claimed_at: new Date().toISOString() })
      .eq("id", data.playerId)
      .is("user_id", null)
      .select("id")
      .maybeSingle();
    if (error) {
      throw new Error(error.code === "23505" ? "This Google account is already linked to another name" : error.message);
    }
    if (!claimed) throw new Error("Someone already picked that name. Ask the admin if that's wrong.");
    await startSession(claimed.id, context.userId);
    return { ok: true };
  });

const runInput = z.object({
  runDate: z.string(),
  km: z.number().positive().max(200),
  durationMinutes: z.number().positive().max(24 * 60).nullable(),
  note: z.string().trim().max(280).nullable(),
  /** data URL of a new screenshot; null = keep existing (edit) */
  photo: z.string().max(9_000_000).nullable(),
});

export const addRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runInput.parse(input))
  .handler(async ({ data }) => {
    const { isValidRunDate } = await import("./league");
    const { admin, requirePlayer, uploadPhoto } = await import("./league.server");
    const me = await requirePlayer();
    if (!isValidRunDate(data.runDate, new Date())) throw new Error("Pick a valid date (not in the future)");
    if (!data.photo) throw new Error("Please add a screenshot of your run");
    const photoPath = await uploadPhoto(me.id, data.photo);
    const db = await admin();
    const { error } = await db.from("runs").insert({
      player_id: me.id,
      run_date: data.runDate,
      meters: Math.round(data.km * 1000),
      duration_seconds: data.durationMinutes ? Math.round(data.durationMinutes * 60) : null,
      note: data.note || null,
      photo_path: photoPath,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { isValidRunDate } = await import("./league");
    const { admin, assertCanEditRun, requirePlayer, uploadPhoto, removePhoto } = await import("./league.server");
    const me = await requirePlayer();
    const run = await assertCanEditRun(data.id, me.id);
    if (!isValidRunDate(data.runDate, new Date())) throw new Error("Pick a valid date (not in the future)");
    const photoPath = data.photo ? await uploadPhoto(me.id, data.photo) : run.photo_path;
    const db = await admin();
    const { error } = await db
      .from("runs")
      .update({
        run_date: data.runDate,
        meters: Math.round(data.km * 1000),
        duration_seconds: data.durationMinutes ? Math.round(data.durationMinutes * 60) : null,
        note: data.note || null,
        photo_path: photoPath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.photo) await removePhoto(run.photo_path);
    return { ok: true };
  });

export const deleteRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { admin, assertCanEditRun, requirePlayer, removePhoto } = await import("./league.server");
    const me = await requirePlayer();
    const run = await assertCanEditRun(data.id, me.id);
    const db = await admin();
    const { error } = await db.from("runs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await removePhoto(run.photo_path);
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

export const addPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(30) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, requireAdmin } = await import("./league.server");
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("players").insert({ name: data.name });
    if (error) throw new Error(error.code === "23505" ? "That name is already in the challenge" : error.message);
    return { ok: true };
  });

/** Admin: free up a name so someone else can claim it (e.g. the wrong person picked it). */
export const resetPlayerLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ playerId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { admin, requireAdmin } = await import("./league.server");
    const me = await requireAdmin();
    if (me.id === data.playerId) throw new Error("You can't reset your own sign-in");
    const db = await admin();
    const { error } = await db
      .from("players")
      .update({ user_id: null, email: null, claimed_at: null })
      .eq("id", data.playerId);
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
