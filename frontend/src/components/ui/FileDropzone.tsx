import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { AlertCircle, FileText, UploadCloud } from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatBytes } from '@/lib/format';

interface FileDropzoneProps {
  accept: string[];
  maxBytes: number;
  onSelect(file: File): void;
  /** External (server/field) error; local validation errors are shown as well. */
  error?: string;
}

function matchesAccept(file: File, accept: string[]): boolean {
  const name = file.name.toLowerCase();
  return accept.some((pattern) => {
    const value = pattern.toLowerCase();
    if (value.startsWith('.')) return name.endsWith(value);
    if (value.endsWith('/*')) return file.type.startsWith(value.slice(0, -1));
    return file.type === value;
  });
}

/** Accessible drag-and-drop upload control; validates size and type before calling onSelect. */
export function FileDropzone({ accept, maxBytes, onSelect, error }: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const message = validationError ?? error;

  function handleFile(file: File) {
    setValidationError(null);
    if (file.size > maxBytes) {
      setValidationError(`File is larger than ${formatBytes(maxBytes)}.`);
      return;
    }
    if (!matchesAccept(file, accept)) {
      setValidationError(`Accepted types: ${accept.join(', ')}.`);
      return;
    }
    setSelectedFile(file);
    onSelect(file);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrag(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') setIsDragging(true);
    if (event.type === 'dragleave') setIsDragging(false);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-panel border-2 border-dashed bg-mint px-6 py-8 text-center transition-colors focus-within:ring-2 focus-within:ring-surface-600',
          isDragging ? 'border-surface-600 bg-line/40' : 'border-line hover:border-surface-600',
        )}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept.join(',')}
          onChange={handleChange}
          className="sr-only"
          aria-label="Choose a file"
        />
        <UploadCloud aria-hidden="true" className="h-9 w-9 text-surface-600" />
        <p className="text-[13px] font-semibold text-forest-900">
          Click to upload or drag and drop
        </p>
        <p className="text-[11px] text-muted">
          {accept.join(', ')} · max {formatBytes(maxBytes)}
        </p>
      </div>

      {selectedFile && !message && (
        <p className="mt-2 flex items-center gap-2 text-[12px] text-ink">
          <FileText aria-hidden="true" className="h-4 w-4 shrink-0 text-surface-600" />
          <span className="truncate font-medium">{selectedFile.name}</span>
          <span className="ml-auto shrink-0 text-muted">{formatBytes(selectedFile.size)}</span>
        </p>
      )}
      {message && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-[12px] text-pill-danger-fg">
          <AlertCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
