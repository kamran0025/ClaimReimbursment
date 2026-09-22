import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

/**
 * Hidden file input + trigger button with client-side type/size validation
 * (mirrored server-side in claimsService — this is UX only, per plan-frontend.md §7).
 */
export function ReceiptUploadButton({
  onFile,
  isUploading,
  label = 'Attach receipt',
  size = 'sm',
}: {
  onFile: (file: File) => void;
  isUploading?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WEBP images or PDF files are allowed.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError('File must be 5MB or smaller.');
      return;
    }
    onFile(file);
  };

  return (
    <div className="flex flex-col items-start gap-1">
      <input ref={inputRef} type="file" accept={ALLOWED_TYPES.join(',')} className="hidden" onChange={handleChange} />
      <Button type="button" variant="outline" size={size} isLoading={isUploading} onClick={() => inputRef.current?.click()}>
        {label}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
