import { describe, it, expect } from "vitest";
import { buildDatasource } from "../knowledge-base";

describe("buildDatasource", () => {
  it("builds web_crawler_data_source for website sources", () => {
    const result = buildDatasource({
      sourceType: "website",
      sourceUrl: "https://example.com",
      storedObjectKey: null,
      fileName: null,
      fileSize: null,
    });

    expect(result).toEqual({
      web_crawler_data_source: {
        base_url: "https://example.com",
        crawling_option: "SCOPED",
        embed_media: true,
      },
    });
  });

  it("builds file_upload_data_source for file sources", () => {
    const result = buildDatasource({
      sourceType: "file",
      sourceUrl: null,
      storedObjectKey: "uploads/doc.pdf",
      fileName: "doc.pdf",
      fileSize: 1024,
    });

    expect(result).toEqual({
      file_upload_data_source: {
        original_file_name: "doc.pdf",
        size_in_bytes: "1024",
        stored_object_key: "uploads/doc.pdf",
      },
    });
  });

  it("builds file_upload_data_source for text sources with stored key", () => {
    const result = buildDatasource({
      sourceType: "text",
      sourceUrl: null,
      storedObjectKey: "uploads/notes.txt",
      fileName: "notes.txt",
      fileSize: 256,
    });

    expect(result).toEqual({
      file_upload_data_source: {
        original_file_name: "notes.txt",
        size_in_bytes: "256",
        stored_object_key: "uploads/notes.txt",
      },
    });
  });

  it("uses '0' for fileSize when fileSize is null", () => {
    const result = buildDatasource({
      sourceType: "file",
      sourceUrl: null,
      storedObjectKey: "uploads/doc.pdf",
      fileName: "doc.pdf",
      fileSize: null,
    });

    expect(result!.file_upload_data_source!.size_in_bytes).toBe("0");
  });

  it("returns null for website source without URL", () => {
    const result = buildDatasource({
      sourceType: "website",
      sourceUrl: null,
      storedObjectKey: null,
      fileName: null,
      fileSize: null,
    });

    expect(result).toBeNull();
  });

  it("returns null when storedObjectKey is missing", () => {
    const result = buildDatasource({
      sourceType: "file",
      sourceUrl: null,
      storedObjectKey: null,
      fileName: "doc.pdf",
      fileSize: 1024,
    });

    expect(result).toBeNull();
  });

  it("returns null when fileName is missing", () => {
    const result = buildDatasource({
      sourceType: "file",
      sourceUrl: null,
      storedObjectKey: "uploads/doc.pdf",
      fileName: null,
      fileSize: 1024,
    });

    expect(result).toBeNull();
  });
});
