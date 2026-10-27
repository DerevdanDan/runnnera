import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { MAX_PUNISHMENT_LENGTH } from "./league";

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { buildDashboard } = await import("./league.server");
  return buildDashboard();
});

/** Who is signed in (for the header on every page), or null. */
export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { currentPlayer } = await import("./league.server");
  const me = await currentPlayer();
  return me ? { playerId: me.id, name: me.name, isAdmin: me.is_admin } : null;
});

export const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { buildStats } = await import("./league.server");
  return buildStats();
});

export const getHistory = createServerFn({ method: "GET" }).handler(async () => {
  const { buildHistory } = await import("./league.server");
  return buildHistory();
});

/**
 * Called right after Google sign-in. Signs straight in if this Google account already owns a name (or a
 * name the admin locked to it), otherwise returns the open names so the person can pick theirs.
 */
export const linkGoogleAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { admin, startSession } = await import("./league.server");
    const { normalizeEmail } = await import("./league");
    const db = await admin();
    const { data: mine } = await db.from("players").select("id").eq("user_id", context.userId).maybeSingle();
    if (mine) {
      await startSession(mine.id, context.userId);
      return { status: "signed_in" as const, unclaimed: [] };
    }
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const { data: open } = await db.from("players").select("id, name, invite_email").is("user_id", null).order("name");
    const reserved = email ? open?.find((p) => p.invite_email === normalizeEmail(email)) : undefined;
    if (reserved) {
      const { data: claimed } = await db
        .from("players")
        .update({ user_id: context.userId, email, claimed_at: new Date().toISOString() })
        .eq("id", reserved.id)
        .is("user_id", null)
        .select("id")
        .maybeSingle();
      if (claimed) {
        await startSession(claimed.id, context.userId);
        return { status: "signed_in" as const, unclaimed: [] };
      }
    }
    // Names locked to someone else's Gmail aren't offered.
    const unclaimed = (open ?? []).filter((p) => !p.invite_email).map(({ id, name }) => ({ id, name }));
    return { status: "pick" as const, unclaimed };
  });

export const claimPlayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ playerId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { admin, startSession } = await import("./league.server");
    const { normalizeEmail } = await import("./league");
    const db = await admin();
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const { data: player } = await db.from("players").select("invite_email").eq("id", data.playerId).maybeSingle();
    if (player?.invite_email && (!email || normalizeEmail(email) !== player.invite_email)) {
      throw new Error("That name is saved for a different Google account");
    }
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
  /** SHA-256 of the original screenshot file, for the duplicate check */
  photoHash: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .optional(),
});

export const addRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runInput.extend({ allowDuplicate: z.boolean().optional() }).parse(input))
  .handler(async ({ data }) => {
    const { isSameRun, isValidRunDate } = await import("./league");
    const { admin, requirePlayer, uploadPhoto } = await import("./league.server");
    const me = await requirePlayer();
    if (!isValidRunDate(data.runDate, new Date())) throw new Error("Pick a valid date (not in the future)");
    if (!data.photo) throw new Error("Please add a screenshot of your run");
    const db = await admin();
    const meters = Math.round(data.km * 1000);
    const durationSeconds = data.durationMinutes ? Math.round(data.durationMinutes * 60) : null;
    const photoHash = data.photoHash ?? null;

    if (!data.allowDuplicate) {
      // runDate and photoHash are validated above, so they're safe inside the filter.
      const filter = photoHash ? `photo_hash.eq.${photoHash},run_date.eq.${data.runDate}` : `run_date.eq.${data.runDate}`;
      const { data: candidates } = await db
        .from("runs")
        .select("player_id, run_date, meters, duration_seconds, photo_hash, player:players(name)")
        .or(filter);
      const mine = { playerId: me.id, runDate: data.runDate, meters, durationSeconds, photoHash };
      const dup = (candidates ?? []).find((c) =>
        isSameRun(mine, {
          playerId: c.player_id,
          runDate: c.run_date,
          meters: c.meters,
          durationSeconds: c.duration_seconds,
          photoHash: c.photo_hash,
        }),
      );
      if (dup) {
        return {
          ok: false as const,
          duplicateOf: { name: dup.player?.name ?? "?", runDate: dup.run_date, km: dup.meters / 1000 },
        };
      }
    }

    const photoPath = await uploadPhoto(me.id, data.photo);
    const { error } = await db.from("runs").insert({
      player_id: me.id,
      run_date: data.runDate,
      meters,
      duration_seconds: durationSeconds,
      note: data.note || null,
      photo_path: photoPath,
      photo_hash: photoHash,
    });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const updateRun = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => runInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { isValidRunDate } = await import("./league");
    const { admin, assertCanEditRun, requirePlayer, uploadPhoto, removePhoto } = await import("./league.server");
    const me = await requirePlayer();
    const run = await assertCanEditRun(data.id, me);
    if (!isValidRunDate(data.runDate, new Date())) throw new Error("Pick a valid date (not in the future)");
    // A new screenshot goes in the runner's folder, even when the admin uploads it.
    const photoPath = data.photo ? await uploadPhoto(run.player_id, data.photo) : run.photo_path;
    const db = await admin();
    const { error } = await db
      .from("runs")
      .update({
        run_date: data.runDate,
        meters: Math.round(data.km * 1000),
        duration_seconds: data.durationMinutes ? Math.round(data.durationMinutes * 60) : null,
        note: data.note || null,
        photo_path: photoPath,
        ...(data.photo ? { photo_hash: data.photoHash ?? null } : {}),
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
    const { admin, assertCanDeleteRun, requirePlayer, removePhoto } = await import("./league.server");
    const me = await requirePlayer();
    const run = await assertCanDeleteRun(data.id, me);
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
    const { admin, requirePlayer } = await import("./league.server");
    const { canDeletePunishment, monthKey } = await import("./league");
    const me = await requirePlayer();
    const db = await admin();
    const { data: punishment } = await db
      .from("punishments")
      .select("id, player_id, month")
      .eq("id", data.id)
      .maybeSingle();
    if (!punishment) throw new Error("That punishment is already gone");
    const { data: spin } = await db.from("spins").select("month").eq("month", punishment.month).maybeSingle();
    const allowed = canDeletePunishment({
      isOwner: punishment.player_id === me.id,
      isAdmin: me.is_admin,
      isCurrentMonth: punishment.month === monthKey(new Date()),
      monthSpun: !!spin,
    });
    if (!allowed) throw new Error(spin ? "That wheel was already spun" : "You can only remove your own punishments");
    const { error } = await db.from("punishments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const optionalEmail = z
  .string()
  .trim()
  .email("That doesn't look like an email address")
  .nullable()
  .optional();

/** Admin: add someone. Newcomers only count from next month, so they can't come last in a partial month. */
export const addPlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ name: z.string().trim().min(1).max(30), email: optionalEmail }).parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, requireAdmin } = await import("./league.server");
    const { monthKey, nextMonthKey, normalizeEmail } = await import("./league");
    await requireAdmin();
    const db = await admin();
    const { error } = await db.from("players").insert({
      name: data.name,
      invite_email: data.email ? normalizeEmail(data.email) : null,
      counts_from: nextMonthKey(monthKey(new Date())),
    });
    if (error) throw new Error(error.code === "23505" ? "That name is already in the challenge" : error.message);
    return { ok: true };
  });

/** Admin: lock a name to a Gmail address, or decide whether a newcomer already counts this month. */
export const updatePlayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ playerId: z.string().uuid(), inviteEmail: optionalEmail, countsThisMonth: z.boolean().optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin, requireAdmin } = await import("./league.server");
    const { monthKey, nextMonthKey, normalizeEmail } = await import("./league");
    await requireAdmin();
    const db = await admin();
    const { data: player } = await db.from("players").select("counts_from").eq("id", data.playerId).maybeSingle();
    if (!player) throw new Error("Unknown player");
    const patch: { invite_email?: string | null; counts_from?: string } = {};
    if (data.inviteEmail !== undefined) patch.invite_email = data.inviteEmail ? normalizeEmail(data.inviteEmail) : null;
    if (data.countsThisMonth !== undefined) {
      const month = monthKey(new Date());
      const next = nextMonthKey(month);
      // Only ever move the start to this month or next, never rewrite which past months someone counted in.
      patch.counts_from = data.countsThisMonth
        ? player.counts_from < month ? player.counts_from : month
        : player.counts_from > next ? player.counts_from : next;
    }
    const { error } = await db.from("players").update(patch).eq("id", data.playerId);
    if (error) throw new Error(error.message);
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

const monthInput = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) });

/** The loser (or the admin) gets a one-time upload slot for a photo or video proving the punishment was done. */
export const startProofUpload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    monthInput
      .extend({
        contentType: z.string().regex(/^(image|video)\/[\w.+-]+$/, "Pick a photo or a video"),
        size: z
          .number()
          .int()
          .positive()
          .max(50 * 1024 * 1024, "That file is over 50 MB, try a shorter video"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { assertCanAddProof, admin, PHOTO_BUCKET } = await import("./league.server");
    await assertCanAddProof(data.month);
    const sub = data.contentType.split("/")[1]!.toLowerCase();
    const ext = ({ jpeg: "jpg", quicktime: "mov", "x-m4v": "m4v" } as Record<string, string>)[sub] ?? sub.replace(/[^a-z0-9]/g, "");
    const path = `proofs/${data.month}/${crypto.randomUUID()}.${ext}`;
    const db = await admin();
    const { data: slot, error } = await db.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
    if (error || !slot) throw new Error("Couldn't start the upload");
    return { path, token: slot.token };
  });

export const saveProof = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => monthInput.extend({ path: z.string().max(200) }).parse(input))
  .handler(async ({ data }) => {
    const { assertCanAddProof, admin, removePhoto } = await import("./league.server");
    const spin = await assertCanAddProof(data.month);
    if (!new RegExp(`^proofs/${data.month}/[0-9a-f-]{36}\\.[a-z0-9]{2,5}$`).test(data.path)) throw new Error("Bad upload");
    const type = /\.(mp4|mov|m4v|webm|3gp|3gpp|ogg|mpeg)$/.test(data.path) ? "video" : "image";
    const db = await admin();
    const { error } = await db
      .from("spins")
      .update({ proof_path: data.path, proof_type: type, proof_at: new Date().toISOString() })
      .eq("month", data.month);
    if (error) throw new Error(error.message);
    if (spin.proof_path && spin.proof_path !== data.path) await removePhoto(spin.proof_path);
    return { ok: true };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { getAppSession } = await import("./session.server");
  const session = await getAppSession();
  await session.clear();
  return { ok: true };
});
