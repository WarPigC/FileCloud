import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/folders/[id] - get a folder and its breadcrumb path
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id },
    include: { parent: true },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  // Build breadcrumb path
  const breadcrumbs: { id: string; name: string }[] = [];
  let current: typeof folder | null = folder;
  while (current) {
    breadcrumbs.unshift({ id: current.id, name: current.name });
    if (current.parentId) {
      current = await prisma.folder.findFirst({
        where: { id: current.parentId, userId: session.user.id },
        include: { parent: true },
      });
    } else {
      break;
    }
  }

  return NextResponse.json({ folder, breadcrumbs });
}

// PATCH /api/folders/[id] - rename a folder
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
      { error: "Folder name is required." },
      { status: 400 }
    );
  }

  const folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  const updated = await prisma.folder.update({
    where: { id },
    data: { name: name.trim() },
  });

  return NextResponse.json(updated);
}

// DELETE /api/folders/[id] - delete a folder (and cascade children/files via DB)
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const folder = await prisma.folder.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!folder) {
    return NextResponse.json({ error: "Folder not found." }, { status: 404 });
  }

  // Collect all files in this folder tree before deleting
  const collectFiles = async (folderId: string): Promise<string[]> => {
    const files = await prisma.file.findMany({
      where: { folderId },
      select: { diskName: true },
    });
    const children = await prisma.folder.findMany({
      where: { parentId: folderId },
      select: { id: true },
    });
    const childFiles = await Promise.all(
      children.map((c) => collectFiles(c.id))
    );
    return [
      ...files.map((f) => f.diskName),
      ...childFiles.flat(),
    ];
  };

  const diskFiles = await collectFiles(id);

  // Delete folder (cascades children and sets file.folderId to null via schema)
  await prisma.folder.delete({ where: { id } });

  // Clean up orphaned files from disk
  const { unlink } = await import("fs/promises");
  const path = await import("path");
  const uploadDir = path.join(process.cwd(), "data", "uploads");
  await Promise.allSettled(
    diskFiles.map((diskName) => unlink(path.join(uploadDir, diskName)))
  );

  return NextResponse.json({ success: true });
}
