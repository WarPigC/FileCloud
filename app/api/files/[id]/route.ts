import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unlink } from "fs/promises";
import { createReadStream, statSync } from "fs";
import path from "path";
import { Readable } from "stream";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

// GET /api/files/[id] - download a file
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const filePath = path.join(UPLOAD_DIR, file.diskName);

  try {
    const stat = statSync(filePath);
    const range = request.headers.get("range");

    if (range) {
      // Partial content for large files / video streaming
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunkSize = end - start + 1;

      const stream = createReadStream(filePath, { start, end });
      const readable = Readable.toWeb(stream) as ReadableStream;

      return new Response(readable, {
        status: 206,
        headers: {
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": chunkSize.toString(),
          "Content-Type": file.mimeType,
        },
      });
    }

    const stream = createReadStream(filePath);
    const readable = Readable.toWeb(stream) as ReadableStream;

    return new Response(readable, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        "Content-Length": stat.size.toString(),
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "File not found on disk." },
      { status: 404 }
    );
  }
}

// PATCH /api/files/[id] - rename a file
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { name } = await request.json();

  if (!name || typeof name !== "string" || name.trim() === "") {
    return NextResponse.json(
      { error: "File name is required." },
      { status: 400 }
    );
  }

  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  const updated = await prisma.file.update({
    where: { id },
    data: { originalName: name.trim() },
  });

  return NextResponse.json({
    id: updated.id,
    originalName: updated.originalName,
    size: updated.size,
    mimeType: updated.mimeType,
    createdAt: updated.createdAt,
    folderId: updated.folderId,
  });
}

// DELETE /api/files/[id] - delete a file
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const file = await prisma.file.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  // Delete from DB first
  await prisma.file.delete({ where: { id } });

  // Delete from disk
  const filePath = path.join(UPLOAD_DIR, file.diskName);
  await unlink(filePath).catch(() => {}); // silently ignore if already gone

  return NextResponse.json({ success: true });
}
