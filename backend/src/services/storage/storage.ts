// Storage abstraction (plan-backend.md §6/§4) — receipts are written and read
// through this interface only, so a future S3 (or any object store) backend
// is a drop-in swap for `localDiskStorage` with no caller changes.
export interface StoredFile {
  /** Opaque key the implementation needs to read the file back later. Persisted as `Receipt.storagePath`. */
  storagePath: string;
}

export interface Storage {
  save(buffer: Buffer, suggestedName: string): Promise<StoredFile>;
  read(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
}
