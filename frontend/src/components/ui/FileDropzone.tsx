import React, { useState, useRef } from 'react';
import { UploadCloud, File, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../../utils/formatters';

export interface FileDropzoneProps {
  onFileSelect: (file: File) => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  disabled?: boolean;
}

export const FileDropzone: React.FC<FileDropzoneProps> = ({
  onFileSelect,
  maxSizeMB = 10,
  acceptedFormats = ['.pdf', '.docx', '.pptx', '.jpg', '.jpeg', '.png', '.csv'],
  disabled = false,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSetFile = (file: File) => {
    setError(null);

    // Size validation
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size exceeds the ${maxSizeMB} MB limit.`);
      return;
    }

    // Format validation
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFormats.includes(ext)) {
      setError(`Invalid format. Accepted: ${acceptedFormats.join(', ')}`);
      return;
    }

    setSelectedFile(file);
    onFileSelect(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-surface-600 bg-mint-100/50'
            : 'border-mint-300/80 hover:border-surface-600 bg-white'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleChange}
          disabled={disabled}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center">
          <UploadCloud className="w-10 h-10 text-surface-600 mb-3" />
          <p className="text-sm font-semibold text-forest-900 mb-1">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-mutedText">
            {acceptedFormats.join(', ')} (Max {maxSizeMB} MB)
          </p>
        </div>
      </div>

      {selectedFile && !error && (
        <div className="mt-3 flex items-center gap-2 p-3 bg-mint-100 rounded-lg text-xs text-forest-900 border border-mint-300">
          <File className="w-4 h-4 text-surface-600 shrink-0" />
          <span className="font-medium truncate">{selectedFile.name}</span>
          <span className="text-mutedText ml-auto shrink-0">
            {formatFileSize(selectedFile.size)}
          </span>
        </div>
      )}

      {error && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-red-600">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
