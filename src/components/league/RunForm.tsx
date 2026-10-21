import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { addRun, deleteRun, updateRun } from "@/lib/league.functions";
import type { FeedRun } from "@/lib/league-types";

/** Downscale an image to max 1600px JPEG data URL so uploads stay small. */
async function compress(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Couldn't read that image"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function RunForm({
  open,
  onOpenChange,
  run,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  run?: FeedRun | null;
}) {
  const add = useServerFn(addRun);
  const update = useServerFn(updateRun);
  const remove = useServerFn(deleteRun);
  const qc = useQueryClient();
  const [date, setDate] = useState(run?.runDate ?? today());
  const [km, setKm] = useState(run ? String(run.meters / 1000) : "");
  const [minutes, setMinutes] = useState(run?.durationSeconds ? String(Math.round(run.durationSeconds / 60)) : "");
  const [note, setNote] = useState(run?.note ?? "");
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = photo ?? run?.photoUrl ?? null;

  const done = async () => {
    await qc.invalidateQueries({ queryKey: ["dashboard"] });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-3xl tracking-wide">{run ? "Edit run" : "Log a run"}</DialogTitle>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const kmNum = Number(km.replace(",", "."));
            if (!(kmNum > 0)) return toast.error("Enter the distance in km");
            if (!run && !photo) return toast.error("Add a screenshot of your run");
            setBusy(true);
            try {
              const payload = {
                runDate: date,
                km: kmNum,
                durationMinutes: minutes ? Number(minutes) : null,
                note: note.trim() || null,
                photo,
              };
              if (run) await update({ data: { ...payload, id: run.id } });
              else await add({ data: payload });
              toast.success(run ? "Run updated" : "Run logged");
              await done();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Couldn't save");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 flex flex-col gap-1.5">
              <Label htmlFor="km">Km</Label>
              <Input id="km" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} placeholder="5.2" />
            </div>
            <div className="col-span-1 flex flex-col gap-1.5">
              <Label htmlFor="min">Minutes</Label>
              <Input id="min" inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value.replace(/\D/g, ""))} placeholder="28" />
            </div>
            <div className="col-span-1 flex flex-col gap-1.5">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="photo">Screenshot of the run</Label>
            <Input
              id="photo"
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  setPhoto(await compress(f));
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't read that image");
                }
              }}
            />
            {preview && <img src={preview} alt="Run screenshot preview" className="mt-2 max-h-64 rounded-md border border-border object-contain" />}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="note">How did it go? (optional)</Label>
            <Textarea id="note" maxLength={280} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Easy morning loop by the river" />
          </div>
          <div className="flex items-center justify-between gap-3">
            {run ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive"
                disabled={busy}
                onClick={async () => {
                  if (!confirm("Delete this run?")) return;
                  setBusy(true);
                  try {
                    await remove({ data: { id: run.id } });
                    toast.success("Run deleted");
                    await done();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Couldn't delete");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={busy} className="bg-gradient-primary font-semibold">
              {busy ? "Saving…" : run ? "Save changes" : "Log run"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
