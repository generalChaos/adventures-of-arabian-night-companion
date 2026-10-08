"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  listImportsAction,
  libraryProgressAction,
  uploadAndExtractAction,
  saveDraftAction,
  rejectImportAction,
  publishImportAction,
  checkDuplicatesAction,
  type ImportRow,
  type DuplicateCandidate,
} from "@/application/commands/content-admin";
import type { LibraryProgressRow } from "@/application/queries/library-progress";
import type { CardDraft } from "@/domain/content/card-schemas";

export function AdminContentClient() {
  const [imports, setImports] = useState<ImportRow[]>([]);
  const [progress, setProgress] = useState<LibraryProgressRow[]>([]);
  const [progressNotes, setProgressNotes] = useState<string | null>(null);
  const [selected, setSelected] = useState<ImportRow | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftNumber, setDraftNumber] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [requestedType, setRequestedType] = useState<
    "ENCOUNTER" | "STATUS" | "TREASURE" | "QUEST"
  >("ENCOUNTER");

  function reload() {
    startTransition(async () => {
      const [importsResult, progressResult] = await Promise.all([
        listImportsAction(),
        libraryProgressAction(),
      ]);
      if (!importsResult.ok) {
        setMessage(importsResult.message);
        return;
      }
      setImports(importsResult.imports);
      if (progressResult.ok) {
        setProgress(progressResult.rows);
        setProgressNotes(progressResult.notes);
      }
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function selectImport(row: ImportRow) {
    setSelected(row);
    setDuplicates([]);
    const draft = row.parsedData as CardDraft | null;
    setDraftTitle(draft?.title ?? "");
    setDraftNumber(draft?.cardNumber != null ? String(draft.cardNumber) : "");
    setDraftNotes(draft?.notes ?? "");
    startTransition(async () => {
      const result = await checkDuplicatesAction(row.id);
      if (result.ok) setDuplicates(result.duplicates);
    });
  }

  function publish(onDuplicate: "ask" | "keep" | "replace", replaceCardId?: string) {
    const draft = currentDraft();
    if (!draft || !selected) return;
    setMessage(null);
    startTransition(async () => {
      await saveDraftAction({ importId: selected.id, draft });
      const result = await publishImportAction({
        importId: selected.id,
        onDuplicate,
        replaceCardId,
      });
      if (!result.ok) {
        setMessage(result.message);
        if (result.duplicates) setDuplicates(result.duplicates);
        return;
      }
      setMessage(
        result.replaced
          ? `Replaced card ${result.cardId}`
          : `Published card ${result.cardId}`,
      );
      setDuplicates([]);
      reload();
    });
  }

  function upload() {
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("requestedType", requestedType);
      const result = await uploadAndExtractAction(form);
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMessage(`Import ${result.importId} ready for review`);
      setFile(null);
      reload();
    });
  }

  function currentDraft(): CardDraft | null {
    if (!selected) return null;
    return {
      cardType: selected.requestedType as CardDraft["cardType"],
      cardNumber: draftNumber ? Number(draftNumber) : null,
      title: draftTitle,
      notes: draftNotes || null,
    };
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            Content library
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a card photo → AI draft → human review → publish. First visitor
            becomes admin if none exist.
          </p>
        </div>
        <Link href="/admin/charts" className="text-sm underline">
          Encounter charts
        </Link>
      </div>

      {progress.length > 0 ? (
        <section className="space-y-2 rounded-lg border p-4" data-testid="library-progress">
          <h2 className="font-medium">Library progress</h2>
          {progressNotes ? (
            <p className="text-xs text-muted-foreground">{progressNotes}</p>
          ) : null}
          <ul className="space-y-1 text-sm">
            {progress.map((row) => {
              const pct =
                row.target > 0
                  ? Math.min(100, Math.round((row.current / row.target) * 100))
                  : 0;
              return (
                <li key={row.key}>
                  <div className="flex justify-between gap-2">
                    <span>{row.label}</span>
                    <span>
                      {row.current}/{row.target}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-muted">
                    <div
                      className="h-full bg-foreground/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Upload & extract</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="type">Card type</Label>
            <select
              id="type"
              className="rounded border px-2 py-1.5 text-sm"
              value={requestedType}
              onChange={(e) =>
                setRequestedType(e.target.value as typeof requestedType)
              }
            >
              <option value="ENCOUNTER">Encounter</option>
              <option value="STATUS">Status</option>
              <option value="TREASURE">Treasure</option>
              <option value="QUEST">Quest</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="file">Image</Label>
            <Input
              id="file"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <Button onClick={upload} disabled={pending || !file}>
            Upload & extract
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Uses OpenAI when OPENAI_API_KEY is set; otherwise a stub draft.
        </p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="space-y-2">
          <h2 className="font-medium">Imports</h2>
          <ul className="space-y-2 text-sm">
            {imports.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className={`w-full rounded border px-3 py-2 text-left ${
                    selected?.id === row.id ? "border-foreground" : ""
                  }`}
                  onClick={() => selectImport(row)}
                >
                  <div className="font-medium">
                    {row.requestedType} · {row.status}
                  </div>
                  <div className="text-xs text-muted-foreground">{row.id}</div>
                </button>
              </li>
            ))}
            {imports.length === 0 ? (
              <li className="text-muted-foreground">No imports yet.</li>
            ) : null}
          </ul>
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-medium">Review</h2>
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an import.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Image: {selected.imagePath}
                {selected.model ? ` · model ${selected.model}` : ""}
              </p>
              <div className="space-y-1">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="num">Card number</Label>
                <Input
                  id="num"
                  value={draftNumber}
                  onChange={(e) => setDraftNumber(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={draftNotes}
                  onChange={(e) => setDraftNotes(e.target.value)}
                />
              </div>
              {duplicates.length > 0 ? (
                <div
                  className="space-y-2 rounded border border-amber-700/30 bg-amber-50 p-3"
                  data-testid="duplicate-panel"
                >
                  <p className="text-sm font-medium text-amber-950">
                    Possible duplicates
                  </p>
                  <ul className="space-y-2 text-sm">
                    {duplicates.map((dup) => (
                      <li
                        key={dup.cardId}
                        className="flex flex-wrap items-center justify-between gap-2"
                      >
                        <span>
                          {dup.cardType}
                          {dup.cardNumber != null ? ` #${dup.cardNumber}` : ""}{" "}
                          {dup.title}{" "}
                          <span className="text-xs text-muted-foreground">
                            ({dup.reasons.join(", ")})
                          </span>
                        </span>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={pending}
                          data-testid={`replace-${dup.cardId}`}
                          onClick={() => publish("replace", dup.cardId)}
                        >
                          Replace this
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    data-testid="keep-both"
                    onClick={() => publish("keep")}
                  >
                    Keep both (publish new)
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    const draft = currentDraft();
                    if (!draft || !selected) return;
                    startTransition(async () => {
                      const result = await saveDraftAction({
                        importId: selected.id,
                        draft,
                      });
                      setMessage(result.ok ? "Draft saved" : result.message);
                      const dup = await checkDuplicatesAction(selected.id);
                      if (dup.ok) setDuplicates(dup.duplicates);
                      reload();
                    });
                  }}
                >
                  Save draft
                </Button>
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!selected) return;
                    startTransition(async () => {
                      const result = await rejectImportAction(selected.id);
                      setMessage(result.ok ? "Rejected" : result.message);
                      setSelected(null);
                      setDuplicates([]);
                      reload();
                    });
                  }}
                >
                  Reject
                </Button>
                <Button
                  disabled={pending}
                  data-testid="publish-import"
                  onClick={() => publish("ask")}
                >
                  Publish
                </Button>
              </div>
            </>
          )}
        </section>
      </div>

      {message ? <p className="text-sm">{message}</p> : null}
    </main>
  );
}
