// 抽象 storage interface。 MinIO/S3 や local fs に差し替え可能にする。
// v0.1 は stub (local-only) + interface のみ。 実 S3 adapter は v0.2+。

export interface PresignedUpload {
  url: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  storage_url: string; // object 完了後の永続 URL (= s3://...)
  expires_at: string;
}

export interface StorageSource {
  /** asset upload 用の pre-signed URL を生成。 */
  presignUpload(input: {
    projectId: string;
    assetId: string;
    filename: string;
    contentType: string;
  }): Promise<PresignedUpload>;
}

/**
 * Stub storage — pre-signed URL を発行する代わりに、 backend が直 PUT を受ける
 * URL を返す (= 開発中の手動アップロード用)。 v0.2+ で MinIO/S3 を入れる。
 */
export class StubStorageSource implements StorageSource {
  constructor(private readonly publicBase: string) {}

  async presignUpload(input: {
    projectId: string;
    assetId: string;
    filename: string;
    contentType: string;
  }): Promise<PresignedUpload> {
    const fname = encodeURIComponent(input.filename);
    return {
      url: `${this.publicBase}/api/projects/${input.projectId}/assets/${input.assetId}/upload-stub`,
      method: 'PUT',
      headers: { 'content-type': input.contentType },
      storage_url: `stub://${input.projectId}/${input.assetId}/${fname}`,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }
}
