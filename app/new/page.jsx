"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Resize/compress an image in the browser so it stores & analyzes cheaply.
async function imageToBase64(file, maxDim = 1600) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1], mime: "image/jpeg" };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SKILL_LEVELS = ["Beginner", "Some experience", "Confident DIYer", "Advanced / trade experience"];
const BUDGETS = ["Under $500", "$500 – $2,000", "$2,000 – $10,000", "$10,000 – $50,000", "Over $50,000", "Not sure yet"];
const TIMELINES = ["A weekend", "A few weekends", "1–3 months", "3+ months", "No deadline"];

export default function NewProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    description: "",
    zipCode: "",
    skillLevel: "",
    budgetRange: "",
    timeline: "",
  });
  const [photo, setPhoto] = useState(null); // File
  const [photoPreview, setPhotoPreview] = useState(null);
  const [doc, setDoc] = useState(null); // File
  const fileInputRef = useRef(null);
  const photosInputRef = useRef(null);

  function selectPhoto(file) {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhoto(file);
    setPhotoPreview(file ? URL.createObjectURL(file) : null);
  }
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function uploadAttachment(projectId, kind, filename, mime, dataBase64) {
    const res = await fetch(`/api/projects/${projectId}/attachments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, filename, mime, dataBase64 }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Failed to upload ${filename}`);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      setStatus("Creating project…");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");

      try {
        if (photo) {
          setStatus("Uploading photo…");
          const { base64, mime } = await imageToBase64(photo);
          await uploadAttachment(data.id, "image", photo.name, mime, base64);
        }
        if (doc) {
          setStatus("Uploading document…");
          const base64 = await fileToBase64(doc);
          await uploadAttachment(data.id, "document", doc.name, doc.type || "text/plain", base64);
        }
      } catch (upErr) {
        // Attachments are optional — continue, but let the user know.
        alert(`Note: ${upErr.message}. The project was still created; you can continue without the attachment.`);
      }

      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
      setStatus("");
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">New DIY Project</h1>
      <p className="mt-1 text-stone-600">
        Describe what you want to do. Next, you&apos;ll get a few clarifying questions to nail down the details.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-6">
        <div>
          <label className="block text-sm font-medium">Project name *</label>
          <input
            value={form.title}
            onChange={set("title")}
            required
            placeholder="e.g., Backyard deck, Bathroom refresh, Fix squeaky stairs"
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">What do you want to do? *</label>
          <textarea
            value={form.description}
            onChange={set("description")}
            required
            rows={5}
            placeholder="Describe the project in your own words — size, what exists today, what you want it to become, style ideas, anything that matters to you."
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium">ZIP / Postal code</label>
            <input
              value={form.zipCode}
              onChange={set("zipCode")}
              placeholder="e.g., 30309 (US$) or M5V 2T6 (CDN$)"
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Your skill level</label>
            <select
              value={form.skillLevel}
              onChange={set("skillLevel")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {SKILL_LEVELS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Budget range</label>
            <select
              value={form.budgetRange}
              onChange={set("budgetRange")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {BUDGETS.map((b) => (
                <option key={b}>{b}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Timeline</label>
            <select
              value={form.timeline}
              onChange={set("timeline")}
              className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 focus:border-amber-500 focus:outline-none"
            >
              <option value="">Select…</option>
              {TIMELINES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-stone-200 bg-white p-4">
          <h2 className="font-medium">Attachments <span className="text-sm font-normal text-stone-400">(optional)</span></h2>
          <p className="mt-1 text-sm text-stone-500">
            Add a photo of the space and/or a document (plans, inspiration, quotes). The AI will study
            them and use the details in every deliverable.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Photo of the space/project</label>
              <div className="mt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium hover:bg-stone-200"
                >
                  Choose File
                </button>
                <button
                  type="button"
                  onClick={() => photosInputRef.current?.click()}
                  className="rounded-lg bg-stone-100 px-3 py-1.5 text-sm font-medium hover:bg-stone-200"
                >
                  Photos / Camera
                </button>
              </div>
              {/* Standard picker: on phones/tablets this offers Photo Library, Camera, and Files;
                  on Mac the dialog sidebar includes the Photos library under Media. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => selectPhoto(e.target.files?.[0] || null)}
              />
              {/* Camera-first picker for phones/tablets; falls back to a file dialog on computers. */}
              <input
                ref={photosInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => selectPhoto(e.target.files?.[0] || null)}
              />
              {photo && (
                <div className="mt-2 flex items-center gap-2">
                  {photoPreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoPreview}
                      alt="Selected photo"
                      className="h-14 w-14 rounded-md border border-stone-200 object-cover"
                    />
                  )}
                  <span className="min-w-0 truncate text-xs text-stone-500">{photo.name}</span>
                  <button
                    type="button"
                    onClick={() => selectPhoto(null)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-stone-400">
                On phones and iPads, either button can use your Photos library or camera. On a Mac,
                the Photos library appears in the file dialog sidebar under Media.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium">Document <span className="font-normal text-stone-400">(PDF preferred, or TXT/MD · max 3MB)</span></label>
              <input
                type="file"
                accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  if (f && f.size > 3 * 1024 * 1024) {
                    alert("Document is over 3MB. Please use a smaller file.");
                    e.target.value = "";
                    return;
                  }
                  setDoc(f);
                }}
                className="mt-1 w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-stone-100 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-stone-200"
              />
              {doc && <p className="mt-1 truncate text-xs text-stone-500">{doc.name}</p>}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-amber-600 px-5 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {submitting ? status || "Creating…" : "Continue to clarifying questions"}
        </button>
      </form>
    </main>
  );
}
