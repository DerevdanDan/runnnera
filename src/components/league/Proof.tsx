import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Proof } from "@/lib/league-types";
import { saveProof, startProofUpload } from "@/lib/league.functions";

export function ProofView({ proof, label }: { proof: NonNullable<Proof>; label: string }) {
  return proof.type === "video" ? (
    <video src={proof.url} controls playsInline preload="metadata" className="max-h-96 w-full rounded-xl bg-black" aria-label={label} />
  ) : (
    <img src={proof.url} alt={label} loading="lazy" className="max-h-96 w-full rounded-xl bg-secondary object-contain" />
  );
}

/**
 * Upload a photo or video (up to 50 MB) proving the punishment was done. The file goes straight from the
 * browser to storage through a one-time signed slot, so big videos don't pass through our server.
 */
export function ProofUpload({ month, hasProof }: { month: string; hasProof: boolean }) {
  const start = useServerFn(startProofUpload);
  const save = useServerFn(saveProof);
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            const slot = await start({ data: { month, contentType: file.type || "image/jpeg", size: file.size } });
            const { error } = await supabase.storage
              .from("run-photos")
              .uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type || "image/jpeg" });
            if (error) throw new Error("The upload failed, try again");
            await save({ data: { month, path: slot.path } });
            toast.success("Proof added");
            await qc.invalidateQueries();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Couldn't add the proof");
          } finally {
            setBusy(false);
          }
        }}
      />
      <Button variant={hasProof ? "secondary" : "default"} disabled={busy} onClick={() => input.current?.click()} className="gap-2">
        <Camera className="h-4 w-4" />
        {busy ? "Uploading…" : hasProof ? "Replace proof" : "Add proof (photo or video)"}
      </Button>
    </>
  );
}
