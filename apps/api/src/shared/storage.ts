import { createWriteStream, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';

export interface StoredObject {
  key: string;
  url: string;
  sizeBytes: number;
}

export interface ObjectStorage {
  put(filename: string, stream: Readable, mimeType: string, sizeBytes: number): Promise<StoredObject>;
  getUrl(key: string): string;
}

export class LocalObjectStorage implements ObjectStorage {
  constructor(
    private readonly root = join(process.cwd(), 'uploads'),
    private readonly publicBase = '/uploads',
  ) {
    if (!existsSync(this.root)) mkdirSync(this.root, { recursive: true });
  }

  async put(
    filename: string,
    stream: Readable,
    _mimeType: string,
    sizeBytes: number,
  ): Promise<StoredObject> {
    const key = `${randomUUID()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const dest = join(this.root, key);
    await pipeline(stream, createWriteStream(dest));
    return { key, url: this.getUrl(key), sizeBytes };
  }

  getUrl(key: string): string {
    return `${this.publicBase}/${key}`;
  }
}

export const objectStorage: ObjectStorage = new LocalObjectStorage();
