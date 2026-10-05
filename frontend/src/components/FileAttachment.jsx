import { useRef, useState } from 'react';
import { Download, FileText, LoaderCircle, Paperclip, X } from 'lucide-react';
import { api } from '../api/client.js';
import { Button, cx, errorMessage } from './ui.jsx';

/**
 * Upload-and-attach control for coursework submissions.
 *
 * Two things about the storage contract shape this component:
 *
 *   1. `POST /files/upload` returns a record whose `url` is a bare
 *      `/uploads/<dir>/<name>` path, but nothing serves that path — neither
 *      Express nor nginx. The only way to read a stored file back is the
 *      authenticated `GET /api/files/:id/download`, so that is the URL we
 *      persist against the submission rather than the record's own `url`.
 *   2. That route requires a bearer token, so a plain <a href> would 401. Files
 *      are fetched as a blob through the shared api client (which attaches the
 *      token and refreshes it) and handed to the browser as an object URL.
 *
 * Keeping submissions behind auth is the point: coursework is other students'
 * work, and a guessable public path would expose all of it.
 */

const MAX_BYTES = 50 * 1024 * 1024;

/** Mirrors the server's multer filter for the formats coursework actually uses. */
const ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.csv,.zip,.png,.jpg,.jpeg,.gif,.webp';

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The persisted fileUrl carries the id; pull it back out to fetch the blob. */
export function fileIdFromUrl(url) {
  return /\/files\/([^/]+)\/download/.exec(url ?? '')?.[1] ?? null;
}

/**
 * Downloads through the api client so the bearer token is attached, then hands
 * the blob to the browser. Revoking on the next tick rather than immediately
 * gives Safari time to pick the URL up.
 */
export async function downloadStoredFile(url, fallbackName = 'attachment') {
  const id = fileIdFromUrl(url);
  if (!id) throw new Error('That attachment has no retrievable file reference.');

  const response = await api.get(`/files/${id}/download`, { responseType: 'blob' });
  const disposition = response.headers?.['content-disposition'] ?? '';
  const named = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  const objectUrl = URL.createObjectURL(response.data);

  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = named ? decodeURIComponent(named) : fallbackName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

/** Read-only row for an attachment already stored against a submission. */
export function AttachedFile({ url, name = 'Submitted file', className }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (!url) return null;

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      await downloadStoredFile(url, name);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5">
        <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-ink">{name}</span>
        <Button size="sm" variant="ghost" icon={Download} onClick={open} loading={busy}>
          Download
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-critical-ink">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Picker + uploader. Calls `onChange(fileUrl | null, meta)` once the upload has
 * actually landed, so the parent never holds a URL for a file that failed.
 */
export function FileAttachmentField({ value, onChange, disabled, subDir = 'assignments' }) {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [meta, setMeta] = useState(null);
  const [dragging, setDragging] = useState(false);

  const upload = async (file) => {
    if (!file) return;
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_BYTES)}.`);
      return;
    }

    const body = new FormData();
    body.append('file', file);
    body.append('subDir', subDir);

    setUploading(true);
    try {
      const { data } = await api.post('/files/upload', body);
      const record = data.data.file;
      // Persist the authenticated download route, not record.url — see the note
      // at the top of this file.
      setMeta({ name: record.originalName, size: record.size });
      onChange(`/api/files/${record.id}/download`, record);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
      // Clearing lets the same filename be re-picked after a failed attempt.
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const clear = () => {
    setMeta(null);
    setError(null);
    onChange(null, null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (disabled || uploading) return;
    upload(event.dataTransfer.files?.[0]);
  };

  if (value) {
    return (
      <div>
        <div className="flex items-center gap-3 rounded-xl border border-positive/30 bg-positive-soft px-3.5 py-2.5">
          <FileText className="h-4 w-4 shrink-0 text-positive" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-medium text-positive-ink">
            {meta?.name ?? 'Attached file'}
            {meta?.size ? (
              <span className="ml-2 font-normal opacity-70">{formatBytes(meta.size)}</span>
            ) : null}
          </span>
          <Button
            size="sm"
            variant="ghost"
            icon={X}
            onClick={clear}
            disabled={disabled}
            aria-label="Remove attached file"
          />
        </div>
        <p className="mt-1.5 text-xs text-ink-subtle">
          Attached. Submitting will replace any file on your previous submission.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled && !uploading) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          'rounded-xl border border-dashed px-4 py-6 text-center transition-colors',
          dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface-sunken',
          (disabled || uploading) && 'opacity-60',
        )}
      >
        {uploading ? (
          <p className="flex items-center justify-center gap-2 text-sm text-ink-muted">
            <LoaderCircle className="h-4 w-4 animate-spin text-accent" aria-hidden="true" />
            Uploading…
          </p>
        ) : (
          <>
            <Paperclip className="mx-auto h-5 w-5 text-ink-subtle" aria-hidden="true" />
            <p className="mt-2 text-sm text-ink-muted">
              Drop a file here, or{' '}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="link"
              >
                choose a file
              </button>
            </p>
            <p className="mt-1 text-xs text-ink-subtle">
              PDF, Word, PowerPoint, Excel, text, zip or an image · up to {formatBytes(MAX_BYTES)}
            </p>
          </>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          disabled={disabled || uploading}
          onChange={(event) => upload(event.target.files?.[0])}
        />
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-critical-ink">
          {error}
        </p>
      )}
    </div>
  );
}
