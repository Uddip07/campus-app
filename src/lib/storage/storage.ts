import { isSupabaseConfigured, getSupabaseConfig } from "../env";
import { createClient } from "@supabase/supabase-js";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export interface UploadAttachmentResult {
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  publicUrl: string;
}

/**
 * Uploads an attachment to Supabase Storage bucket 'announcements'.
 * Fails truthfully if storage configuration is missing.
 */
export async function uploadAnnouncementAttachment(
  file: File | Blob,
  fileName: string,
  mimeType: string
): Promise<UploadAttachmentResult> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      "Attachment upload unavailable: Storage configuration is missing."
    );
  }

  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `File type "${mimeType}" is not allowed. Supported formats: PDF, Images (JPEG/PNG/WEBP), DOC, DOCX.`
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(
      `File size exceeds maximum limit of 10MB (${(file.size / (1024 * 1024)).toFixed(2)}MB).`
    );
  }

  const { url, serviceKey } = getSupabaseConfig();
  if (!serviceKey) {
    throw new Error(
      "Attachment upload unavailable: SUPABASE_SERVICE_ROLE_KEY is required for server uploads."
    );
  }

  const supabase = createClient(url, serviceKey);
  const fileExt = fileName.split(".").pop() || "bin";
  const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
  const storagePath = `attachments/${uniqueName}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error } = await supabase.storage
    .from("announcements")
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload attachment to storage: ${error.message}`);
  }

  const { data: publicData } = supabase.storage
    .from("announcements")
    .getPublicUrl(storagePath);

  return {
    storagePath,
    fileName,
    mimeType,
    fileSize: file.size,
    publicUrl: publicData.publicUrl,
  };
}
