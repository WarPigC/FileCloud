import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB

// GET /api/files - list files for authenticated user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folderId") || null;

  const files = await prisma.file.findMany({
    where: {
      userId: session.user.id,
      folderId: folderId,
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      originalName: true,
      size: true,
      mimeType: true,
      createdAt: true,
      folderId: true,
    },
  });

  return NextResponse.json(files);
}

// POST /api/files - upload a file
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds 500MB limit." },
        { status: 413 }
      );
    }

    // Validate folderId belongs to user
    if (folderId) {
      const folder = await prisma.folder.findFirst({
        where: { id: folderId, userId: session.user.id },
      });
      if (!folder) {
        return NextResponse.json(
          { error: "Folder not found." },
          { status: 404 }
        );
      }
    }

    // Ensure upload dir exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // Generate unique disk name preserving extension
    const ext = path.extname(file.name);
    const diskName = `${uuidv4()}${ext}`;
    const filePath = path.join(UPLOAD_DIR, diskName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const saved = await prisma.file.create({
      data: {
        originalName: file.name,
        diskName,
        size: file.size,
        mimeType: file.type || "application/octet-stream",
        userId: session.user.id,
        folderId: folderId || null,
      },
    });

    return NextResponse.json(
      {
        id: saved.id,
        originalName: saved.originalName,
        size: saved.size,
        mimeType: saved.mimeType,
        createdAt: saved.createdAt,
        folderId: saved.folderId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
