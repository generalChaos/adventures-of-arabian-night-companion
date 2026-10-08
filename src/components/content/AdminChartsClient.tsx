"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  addChartEntryAction,
  listChartsAction,
  listMatrixCellsAction,
  upsertMatrixAction,
  type ChartEntryRow,
  type MatrixSummary,
} from "@/application/commands/content-charts";
import { DEFAULT_REACTIONS } from "@/domain/content/matrix-validation";

export function AdminChartsClient() {
  const [matrices, setMatrices] = useState<MatrixSummary[]>([]);
  const [chartEntries, setChartEntries] = useState<ChartEntryRow[]>([]);
  const [matrixNumber, setMatrixNumber] = useState("2");
  const [rowKeys, setRowKeys] = useState("merchant,guard,nomad");
  const [cellDraft, setCellDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [entryKey, setEntryKey] = useState("encounter");
  const [rollMin, setRollMin] = useState("1");
  const [rollMax, setRollMax] = useState("2");
  const [descriptor, setDescriptor] = useState("guard");
  const [matrixId, setMatrixId] = useState("");

  function reload() {
    startTransition(async () => {
      const result = await listChartsAction();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMatrices(result.matrices);
      setChartEntries(result.chartEntries);
      if (!matrixId && result.matrices[0]) {
        setMatrixId(result.matrices[0].id);
      }
    });
  }

  useEffect(() => {
    startTransition(async () => {
      const result = await listChartsAction();
      if (!result.ok) {
        setMessage(result.message);
        return;
      }
      setMatrices(result.matrices);
      setChartEntries(result.chartEntries);
      if (result.matrices[0]) setMatrixId(result.matrices[0].id);
    });
  }, []);

  function buildCellsFromGrid() {
    const rows = rowKeys
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lines = cellDraft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    // Format: rowKey reaction paragraph
    const cells = lines.map((line) => {
      const [rowKey, reaction, para] = line.split(/\s+/);
      return {
        rowKey: rowKey!,
        reaction: reaction!,
        paragraphNumber: Number(para),
      };
    });
    return { rows, cells };
  }

  function fillTemplate() {
    const rows = rowKeys
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const lines: string[] = [];
    let n = 200;
    for (const row of rows) {
      for (const reaction of DEFAULT_REACTIONS) {
        lines.push(`${row} ${reaction} ${n}`);
        n += 1;
      }
    }
    setCellDraft(lines.join("\n"));
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl">
            Encounter charts
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter reaction matrices and chart rows. Every row × reaction needs a
            paragraph number.
          </p>
        </div>
        <Link href="/admin" className="text-sm underline">
          Content library
        </Link>
      </div>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Matrices</h2>
        <ul className="text-sm">
          {matrices.map((m) => (
            <li key={m.id}>
              Matrix #{m.matrixNumber} · {m.cellCount} cells ·{" "}
              <button
                type="button"
                className="underline"
                onClick={() => {
                  startTransition(async () => {
                    const result = await listMatrixCellsAction(m.id);
                    if (!result.ok) {
                      setMessage(result.message);
                      return;
                    }
                    setMatrixNumber(String(m.matrixNumber));
                    setMatrixId(m.id);
                    const rows = [
                      ...new Set(result.cells.map((c) => c.rowKey)),
                    ];
                    setRowKeys(rows.join(","));
                    setCellDraft(
                      result.cells
                        .map(
                          (c) =>
                            `${c.rowKey} ${c.reaction} ${c.paragraphNumber}`,
                        )
                        .join("\n"),
                    );
                  });
                }}
              >
                Load
              </button>
            </li>
          ))}
          {matrices.length === 0 ? (
            <li className="text-muted-foreground">No matrices yet.</li>
          ) : null}
        </ul>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="matrixNum">Matrix number</Label>
            <Input
              id="matrixNum"
              value={matrixNumber}
              onChange={(e) => setMatrixNumber(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="rows">Row keys (comma-separated)</Label>
            <Input
              id="rows"
              value={rowKeys}
              onChange={(e) => setRowKeys(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label htmlFor="cells">
            Cells (`rowKey reaction paragraph` per line)
          </Label>
          <textarea
            id="cells"
            className="min-h-40 w-full rounded border px-2 py-1 font-mono text-xs"
            value={cellDraft}
            onChange={(e) => setCellDraft(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={pending} onClick={fillTemplate}>
            Fill template
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              const { rows, cells } = buildCellsFromGrid();
              startTransition(async () => {
                const result = await upsertMatrixAction({
                  matrixNumber: Number(matrixNumber),
                  rowKeys: rows,
                  cells,
                });
                setMessage(
                  result.ok ? `Saved matrix ${result.matrixId}` : result.message,
                );
                reload();
              });
            }}
          >
            Save matrix
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">Chart entries</h2>
        <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
          {chartEntries.map((e) => (
            <li key={e.id}>
              {e.encounterKey} · roll {e.rollMin}–{e.rollMax} → {e.descriptor}
              {e.matrixId ? ` · matrix ${e.matrixId.slice(0, 8)}…` : ""}
            </li>
          ))}
        </ul>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label>Encounter key</Label>
            <Input value={entryKey} onChange={(e) => setEntryKey(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descriptor</Label>
            <Input
              value={descriptor}
              onChange={(e) => setDescriptor(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Roll min</Label>
            <Input value={rollMin} onChange={(e) => setRollMin(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Roll max</Label>
            <Input value={rollMax} onChange={(e) => setRollMax(e.target.value)} />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Matrix id</Label>
            <select
              className="w-full rounded border px-2 py-1.5 text-sm"
              value={matrixId}
              onChange={(e) => setMatrixId(e.target.value)}
            >
              <option value="">None</option>
              {matrices.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.matrixNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await addChartEntryAction({
                encounterKey: entryKey,
                rollMin: Number(rollMin),
                rollMax: Number(rollMax),
                descriptor,
                matrixId: matrixId || null,
              });
              setMessage(result.ok ? `Added chart entry ${result.id}` : result.message);
              reload();
            });
          }}
        >
          Add chart entry
        </Button>
      </section>

      {message ? <p className="text-sm">{message}</p> : null}
    </main>
  );
}
