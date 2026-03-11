export async function parseTeachingFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();

  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return file.text();
  }

  if (name.endsWith('.pdf')) {
    return parsePdfFile(file);
  }

  if (name.endsWith('.docx')) {
    return parseDocxFile(file);
  }

  if (name.endsWith('.doc')) {
    throw new Error('当前仅支持 docx，不支持旧版 doc。请先转换为 docx 后上传。');
  }

  throw new Error('不支持的文件格式，请上传 txt/md/pdf/docx。');
}

async function parsePdfFile(file: File): Promise<string> {
  const [pdfjs, workerUrlModule] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);

  (pdfjs as any).GlobalWorkerOptions.workerSrc = workerUrlModule.default;

  const data = await file.arrayBuffer();
  const loadingTask = (pdfjs as any).getDocument({ data });
  const doc = await loadingTask.promise;

  let fullText = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item?.str || '')
      .filter(Boolean)
      .join(' ');
    fullText += `${pageText}\n`;
  }

  return fullText.trim();
}

async function parseDocxFile(file: File): Promise<string> {
  const mammoth = await import('mammoth/mammoth.browser');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}
