import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EASE_OUT, springSoft } from "@/components/ui/motion";
import { SUPPORTED_IMAGE_TYPES } from "@/api/rooms";
import { cn } from "@/lib/cn";

interface DropzoneProps {
  file: File | null;
  onFileSelected: (file: File) => void;
  onClear: () => void;
  error: string | null;
  disabled?: boolean;
}

export function Dropzone({ file, onFileSelected, onClear, error, disabled }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = usePreviewUrl(file);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const selected = files?.[0];
      if (!selected) return;
      onFileSelected(selected);
    },
    [onFileSelected],
  );

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  }

  if (file && previewUrl) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
        className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-soft"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-stone-100">
          <motion.img
            src={previewUrl}
            alt="Preview of the room you selected to upload"
            className="h-full w-full object-cover"
            initial={{ scale: 1.08, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{file.name}</p>
            <p className="text-xs text-stone-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={disabled}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-[background-color,border-color,transform] duration-200 hover:border-stone-400 hover:bg-stone-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onClear}
              disabled={disabled}
              className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-700 transition-[background-color,border-color,transform] duration-200 hover:border-stone-400 hover:bg-stone-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              Remove
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
        <AnimatePresence initial={false}>
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        role="button"
        tabIndex={0}
        aria-label="Upload a photo of your room"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        animate={{ scale: isDragging ? 1.015 : 1 }}
        whileTap={disabled ? undefined : { scale: 0.99 }}
        transition={springSoft}
        className={cn(
          "group flex aspect-[4/3] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center transition-[background-color,border-color,box-shadow] duration-300",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne-500",
          isDragging ? "border-clay-500 bg-clay-50 shadow-lg" : "border-stone-300 bg-stone-50 hover:border-sage-500 hover:bg-surface-sage/50 hover:shadow-soft",
          disabled && "cursor-not-allowed opacity-60",
        )}
      >
        <motion.svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={cn("transition-colors duration-300", isDragging ? "text-clay-600" : "text-stone-400 group-hover:text-sage-600")}
          animate={isDragging ? { y: -6, scale: 1.1 } : { y: [0, -3, 0], scale: 1 }}
          transition={isDragging ? springSoft : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <path
            d="M12 16V4m0 0L7 9m5-5l5 5M5 20h14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </motion.svg>
        <div>
          <p className="text-sm font-medium text-stone-900">Drag and drop your room photo, or click to browse</p>
          <p className="mt-1 text-xs text-stone-500">
            A clear, well-lit photo of the whole room produces the best visualization. JPEG, PNG or WebP · up to 10 MB.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </motion.div>

      {/* A single <input> can't both open the library and force the camera across
          mobile browsers, so a second hidden input with capture="environment"
          backs this button. Harmless on desktop: capture is simply ignored there. */}
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        disabled={disabled}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition-[background-color,border-color,box-shadow,transform] duration-200 hover:border-stone-400 hover:bg-stone-50 hover:shadow-soft active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        Take a Photo
      </button>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key="error"
            className="mt-2 text-sm text-red-700"
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function usePreviewUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}
