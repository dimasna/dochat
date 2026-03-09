import { DocsContent } from "@/modules/docs/ui/components/docs-content";
import Link from "next/link";

export const metadata = {
  title: "Knowledge Base - Dochat Docs",
  description: "Learn how to build and manage knowledge bases for your AI agents",
};

export default function KnowledgeBasePage() {
  return (
    <DocsContent>
      <h1>Knowledge Base</h1>
      <p>Knowledge bases are collections of information that your AI agents use to answer customer questions. You can add documents, websites, and text content to train your agents on your specific domain.</p>

      <h2>Creating a Knowledge Base</h2>
      <ol>
        <li>Go to <strong>Knowledge Base</strong> in your workspace sidebar</li>
        <li>Click <strong>"Create"</strong></li>
        <li>Give it a descriptive name (e.g., "Product Documentation")</li>
        <li>Add your content sources</li>
      </ol>

      <h2>Content Sources</h2>
      <h3>File Upload</h3>
      <p>Upload documents directly to your knowledge base:</p>
      <ul>
        <li><strong>PDF</strong> — documentation, guides, manuals</li>
        <li><strong>DOCX</strong> — Word documents</li>
        <li><strong>TXT</strong> — plain text files</li>
        <li><strong>CSV</strong> — structured data</li>
      </ul>

      <h3>Website Crawling</h3>
      <p>Import content from your website or documentation:</p>
      <ol>
        <li>Enter the starting URL (e.g., <code>https://docs.example.com</code>)</li>
        <li>The crawler follows links within the same domain</li>
        <li>Content is extracted and indexed automatically</li>
      </ol>
      <blockquote>The crawler respects <code>robots.txt</code> and only processes publicly accessible pages.</blockquote>

      <h3>Text Sources</h3>
      <p>Paste or type content directly — ideal for FAQs, policies, and quick reference material.</p>

      <h2>Folder Organization</h2>
      <p>Knowledge bases are organized as folders containing multiple sources. This helps you:</p>
      <ul>
        <li>Group related content together (e.g., "API Docs", "FAQs", "Policies")</li>
        <li>Manage indexing per folder</li>
        <li>Attach specific folders to different agents</li>
      </ul>

      <h2>Indexing</h2>
      <p>After adding content, indexing makes it searchable by your agents:</p>
      <ol>
        <li>Content is extracted from documents and web pages</li>
        <li>Text is split into searchable chunks</li>
        <li>Vector embeddings are generated for semantic search</li>
        <li>Vectors are stored in a searchable database</li>
      </ol>

      <h3>Indexing Status</h3>
      <table>
        <thead>
          <tr>
            <th>Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Pending</strong></td>
            <td>Knowledge base is being provisioned</td>
          </tr>
          <tr>
            <td><strong>Indexing</strong></td>
            <td>Content is being processed and embedded</td>
          </tr>
          <tr>
            <td><strong>Ready</strong></td>
            <td>Content is searchable and can be attached to agents</td>
          </tr>
          <tr>
            <td><strong>Failed</strong></td>
            <td>Something went wrong — check source format and retry</td>
          </tr>
        </tbody>
      </table>
      <p>Initial provisioning can take a few minutes. Subsequent indexing is faster.</p>

      <h2>Updating Content</h2>
      <ol>
        <li>Add, remove, or modify sources in your knowledge base</li>
        <li>Click <strong>"Re-index"</strong> to update</li>
        <li>Wait for indexing to complete</li>
      </ol>
      <p>Agents automatically use the latest indexed content — no need to reconfigure them.</p>

      <h2>Best Practices</h2>
      <ul>
        <li>Use well-structured, clearly written documents for best results</li>
        <li>Keep content focused and relevant to your use case</li>
        <li>Organize sources into logical folders</li>
        <li>Remove outdated information to improve accuracy</li>
        <li>Re-index after any content changes</li>
        <li>Test knowledge retrieval in the Playground before deploying</li>
      </ul>
    </DocsContent>
  );
}
