"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useToast, ToastContainer } from "@/components/Toast";
import InputModal from "@/components/InputModal";
import { formatFileSize, getFileIcon, getFileColor, timeAgo } from "@/lib/utils";

interface FileItem {
  id: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: string;
  folderId: string | null;
}

interface FolderItem {
  id: string;
  name: string;
  createdAt: string;
  parentId: string | null;
}

interface Breadcrumb {
  id: string;
  name: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const { toasts, addToast } = useToast();

  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [loading, setLoading] = useState(true);

  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number }[]>([]);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ type: "file" | "folder"; id: string; name: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch contents
  const fetchContents = useCallback(async (folderId: string | null) => {
    setLoading(true);
    const folderQs = folderId ? `?parentId=${folderId}` : "";
    const fileQs = folderId ? `?folderId=${folderId}` : "";

    const [foldersRes, filesRes] = await Promise.all([
      fetch(`/api/folders${folderQs}`),
      fetch(`/api/files${fileQs}`),
    ]);

    if (foldersRes.ok) setFolders(await foldersRes.json());
    if (filesRes.ok) setFiles(await filesRes.json());

    // Fetch breadcrumbs
    if (folderId) {
      const bcRes = await fetch(`/api/folders/${folderId}`);
      if (bcRes.ok) {
        const data = await bcRes.json();
        setBreadcrumbs(data.breadcrumbs || []);
      }
    } else {
      setBreadcrumbs([]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated") fetchContents(currentFolderId);
  }, [status, currentFolderId, fetchContents]);

  // Navigate to folder
  function openFolder(folderId: string | null) {
    setCurrentFolderId(folderId);
  }

  // Create folder
  async function handleCreateFolder(name: string) {
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, parentId: currentFolderId }),
    });
    if (res.ok) {
      addToast(`Folder "${name}" created`, "success");
      fetchContents(currentFolderId);
    } else {
      addToast("Failed to create folder", "error");
    }
  }

  // Upload files
  async function uploadFiles(fileList: FileList) {
    const fileArr = Array.from(fileList);
    const newUploads = fileArr.map((f) => ({ name: f.name, progress: 0 }));
    setUploads((prev) => [...prev, ...newUploads]);

    for (let i = 0; i < fileArr.length; i++) {
      const file = fileArr[i];
      const formData = new FormData();
      formData.append("file", file);
      if (currentFolderId) formData.append("folderId", currentFolderId);

      try {
        // Use XHR for progress tracking
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/files");

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              const pct = Math.round((e.loaded / e.total) * 100);
              setUploads((prev) =>
                prev.map((u) =>
                  u.name === file.name ? { ...u, progress: pct } : u
                )
              );
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(xhr.statusText));
          };
          xhr.onerror = () => reject(new Error("Upload failed"));
          xhr.send(formData);
        });

        addToast(`Uploaded "${file.name}"`, "success");
      } catch {
        addToast(`Failed to upload "${file.name}"`, "error");
      }
    }

    setUploads([]);
    fetchContents(currentFolderId);
  }

  // Drag and drop handlers
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadFiles(e.dataTransfer.files);
  }

  // Delete
  async function handleDeleteFile(id: string, name: string) {
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast(`Deleted "${name}"`, "success");
      fetchContents(currentFolderId);
    } else {
      addToast("Failed to delete file", "error");
    }
  }

  async function handleDeleteFolder(id: string, name: string) {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      addToast(`Deleted folder "${name}"`, "success");
      fetchContents(currentFolderId);
    } else {
      addToast("Failed to delete folder", "error");
    }
  }

  // Rename
  async function handleRename(value: string) {
    if (!renameTarget) return;
    const endpoint = renameTarget.type === "file"
      ? `/api/files/${renameTarget.id}`
      : `/api/folders/${renameTarget.id}`;

    const res = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: value }),
    });

    if (res.ok) {
      addToast("Renamed successfully", "success");
      fetchContents(currentFolderId);
    } else {
      addToast("Rename failed", "error");
    }
    setRenameTarget(null);
  }

  // Download
  function handleDownload(id: string, name: string) {
    const a = document.createElement("a");
    a.href = `/api/files/${id}`;
    a.download = name;
    a.click();
  }

  if (status === "loading") {
    return <div className="page-loader"><div className="spinner" /></div>;
  }

  const userInitial = session?.user?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <span className="sidebar-logo-text">TempDrive</span>
        </div>

        <nav className="sidebar-nav">
          <div
            className={`sidebar-item ${currentFolderId === null ? "active" : ""}`}
            onClick={() => openFolder(null)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            My Drive
          </div>

          <div className="sidebar-section-title">Quick Actions</div>

          <div className="sidebar-item" onClick={() => setNewFolderOpen(true)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
            New Folder
          </div>

          <div className="sidebar-item" onClick={() => fileInputRef.current?.click()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Upload File
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user" onClick={() => signOut()}>
            <div className="user-avatar">{userInitial}</div>
            <div className="user-info">
              <div className="user-name">{session?.user?.name}</div>
              <div className="user-email">{session?.user?.email}</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="main-content">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-breadcrumbs">
            <span
              className="breadcrumb-item clickable"
              onClick={() => openFolder(null)}
            >
              My Drive
            </span>
            {breadcrumbs.map((bc, i) => (
              <span key={bc.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span className="breadcrumb-separator">/</span>
                <span
                  className={`breadcrumb-item ${i === breadcrumbs.length - 1 ? "current" : "clickable"}`}
                  onClick={() => {
                    if (i < breadcrumbs.length - 1) openFolder(bc.id);
                  }}
                >
                  {bc.name}
                </span>
              </span>
            ))}
          </div>
          <div className="topbar-actions">
            <button className="btn btn-ghost btn-sm" onClick={() => setNewFolderOpen(true)}>
              + Folder
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()}>
              ↑ Upload
            </button>
          </div>
        </header>

        {/* Drive Content */}
        <div className="drive-content">
          {/* Upload Zone */}
          <div
            className={`upload-zone ${dragging ? "dragging" : ""}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="upload-zone-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
            <div className="upload-zone-title">Drop files here or click to upload</div>
            <div className="upload-zone-sub">Up to 500 MB per file</div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                uploadFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />

          {/* Upload Progress */}
          {uploads.length > 0 && (
            <div className="upload-progress-list">
              {uploads.map((u) => (
                <div key={u.name} className="upload-progress-item">
                  <span className="upload-progress-name">{u.name}</span>
                  <div className="progress-bar-wrap">
                    <div className="progress-bar" style={{ width: `${u.progress}%` }} />
                  </div>
                  <span className="file-card-meta">{u.progress}%</span>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="page-loader" style={{ minHeight: 200 }}><div className="spinner" /></div>
          ) : (
            <>
              {/* Folders */}
              {folders.length > 0 && (
                <>
                  <div className="files-section-title">Folders</div>
                  <div className="folder-grid">
                    {folders.map((folder) => (
                      <div
                        key={folder.id}
                        className="folder-card"
                        onDoubleClick={() => openFolder(folder.id)}
                        onClick={() => openFolder(folder.id)}
                      >
                        <div className="folder-card-icon">📁</div>
                        <div className="folder-card-name">{folder.name}</div>
                        <div className="folder-card-actions">
                          <button
                            className="btn-icon"
                            title="Rename"
                            onClick={(e) => { e.stopPropagation(); setRenameTarget({ type: "folder", id: folder.id, name: folder.name }); }}
                          >✏️</button>
                          <button
                            className="btn-icon"
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }}
                          >🗑️</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Files */}
              {files.length > 0 && (
                <>
                  <div className="files-section-title">Files</div>
                  <div className="file-grid">
                    {files.map((file) => (
                      <div key={file.id} className="file-card">
                        <div className="file-card-actions">
                          <button className="btn-icon" title="Download" onClick={() => handleDownload(file.id, file.originalName)}>⬇️</button>
                          <button className="btn-icon" title="Rename" onClick={() => setRenameTarget({ type: "file", id: file.id, name: file.originalName })}>✏️</button>
                          <button className="btn-icon" title="Delete" onClick={() => handleDeleteFile(file.id, file.originalName)}>🗑️</button>
                        </div>
                        <div
                          className="file-card-icon"
                          style={{ background: getFileColor(file.mimeType) }}
                        >
                          {getFileIcon(file.mimeType)}
                        </div>
                        <div className="file-card-name">{file.originalName}</div>
                        <div className="file-card-meta">
                          {formatFileSize(file.size)} · {timeAgo(file.createdAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Empty State */}
              {folders.length === 0 && files.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-icon">📂</div>
                  <div className="empty-state-title">This folder is empty</div>
                  <div className="empty-state-sub">Drop files here or create a new folder to get started</div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <InputModal
        title="New Folder"
        isOpen={newFolderOpen}
        onClose={() => setNewFolderOpen(false)}
        onSubmit={handleCreateFolder}
        placeholder="Folder name"
        submitLabel="Create"
      />

      {renameTarget && (
        <InputModal
          title={`Rename ${renameTarget.type}`}
          isOpen={true}
          onClose={() => setRenameTarget(null)}
          onSubmit={handleRename}
          defaultValue={renameTarget.name}
          placeholder="New name"
          submitLabel="Rename"
        />
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
