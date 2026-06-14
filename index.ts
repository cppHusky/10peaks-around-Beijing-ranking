import "./styles.css";
import { BRANCHES, PEAKS, branchCounts, hasPeak } from "./src/shared/peaks";

type LeaderboardRow = {
  serial: number;
  name: string;
  mask: number;
  total_count: number;
};

type PeakActivity = {
  source: string;
  start_date: string;
  end_date: string;
  counted: number;
};

type FileList = {
  attendance: null | { name: string; key: string; size: number; uploaded: string | null };
  activities: Array<{ name: string; key: string; size: number; uploaded: string | null }>;
};

type UploadResult = {
  count?: number;
  rows?: number;
};

type UploadProgressElements = {
  root: HTMLElement;
  bar: HTMLElement;
  label: HTMLElement;
  percent: HTMLElement;
};

const root = document.getElementById("app");
if (!root) throw new Error("缺少 #app 容器");
const app = root;

const branchColors = ["#6f8f4d", "#c28e3e", "#866e9f", "#bd6c47", "#4f7f91", "#8c765f"];

function route(): void {
  if (location.pathname.startsWith("/admin")) {
    renderAdmin();
  } else {
    renderPublic();
  }
}

async function renderPublic(): Promise<void> {
  app.innerHTML = `
    <main class="shell public-shell">
      <header class="hero">
        <div>
          <p class="eyebrow">徒步强国</p>
          <h1>京畿十峰挑战赛排行榜</h1>
        </div>
        <a class="text-link" href="/admin">管理员入口</a>
      </header>
      <section id="public-content" class="panel muted-panel">正在读取排行榜...</section>
    </main>
  `;

  try {
    const data = await api<{ rows: LeaderboardRow[] }>("/api/leaderboard");
    renderLeaderboard(data.rows);
  } catch (error) {
    setPublicContent(`<div class="empty-state"><h2>暂时无法读取榜单</h2><p>${escapeHtml(errorMessage(error))}</p></div>`);
  }
}

function renderLeaderboard(rows: LeaderboardRow[]): void {
  setPublicContent(`
    ${rows.length > 0 ? `
      <div class="toolbar chart-toolbar">
        <div class="actions">
          <button class="button" id="download-png" type="button">下载 PNG</button>
        </div>
      </div>
    ` : ""}
    ${rows.length === 0 ? `<div class="empty-state"><h2>还没有有效打卡数据</h2><p>管理员上传报名表和活动参与表后，完成数大于 0 的参与者会出现在这里。</p></div>` : ""}
    ${rows.length > 0 ? `<div class="chart-wrap">${leaderboardSvg(rows)}</div>${detailTable(rows)}` : ""}
  `);

  document.getElementById("download-png")?.addEventListener("click", () => downloadPng());
  bindPeakPopover();
}

function detailTable(rows: LeaderboardRow[]): string {
  let rank = 1;
  return `
    <section class="detail-section">
      <h2>打卡详表</h2>
      <div class="table-wrap">
        <table class="detail-table">
          <thead><tr><th>排名</th><th>名字</th><th>完成打卡点</th></tr></thead>
          <tbody>
            ${rows.map((row) => {
              const displayRank = hasPeak(row.mask, 0) ? String(rank++) : "*";
              return `
                <tr>
                  <td class="detail-rank">${displayRank}</td>
                  <td class="detail-name">${escapeHtml(row.name)}</td>
                  <td><div class="chip-list">${completedPeakChips(row.mask, row.serial)}</div></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
    <div id="peak-popover" class="peak-popover" hidden></div>
  `;
}

function completedPeakChips(mask: number, serial: number): string {
  return PEAKS
    .flatMap((peak, index) => hasPeak(mask, index)
      ? [`<button class="chip chip-btn" type="button" data-serial="${serial}" data-peak="${index}">${escapeHtml(peak)}</button>`]
      : []
    )
    .join("");
}

function bindPeakPopover(): void {
  const popover = document.getElementById("peak-popover");
  if (!popover) return;

  let activeBtn: HTMLElement | null = null;

  function closePopover(): void {
    popover!.hidden = true;
    activeBtn?.removeAttribute("aria-expanded");
    activeBtn = null;
  }

  document.addEventListener("click", (event) => {
    const btn = (event.target as Element).closest<HTMLElement>(".chip-btn");
    if (!btn) { closePopover(); return; }
    if (btn === activeBtn) { closePopover(); return; }

    const serial = Number(btn.dataset.serial);
    const peakIndex = Number(btn.dataset.peak);
    const peakName = PEAKS[peakIndex] ?? "";

    activeBtn?.removeAttribute("aria-expanded");
    activeBtn = btn;
    btn.setAttribute("aria-expanded", "true");

    popover.hidden = false;
    popover.innerHTML = `<div class="peak-popover-title">${escapeHtml(peakName)}</div><div class="peak-popover-loading">加载中...</div>`;
    positionPopover(popover, btn);

    api<{ activities: PeakActivity[] }>(`/api/leaderboard/peak-activities?serial=${serial}&peak=${peakIndex}`)
      .then(({ activities }) => {
        if (activeBtn !== btn) return;
        if (activities.length === 0) {
          popover.innerHTML = `<div class="peak-popover-title">${escapeHtml(peakName)}</div><div class="peak-popover-empty">无活动记录</div>`;
          return;
        }
        const rows = activities.map((a) => `
          <tr class="${a.counted ? "" : "peak-activity-uncounted"}">
            <td>${escapeHtml(a.source)}</td>
            <td>${escapeHtml(a.start_date)}</td>
            <td>${escapeHtml(a.end_date)}</td>
            ${a.counted ? "" : "<td class=\"peak-activity-badge\">未计入</td>"}
          </tr>`).join("");
        popover.innerHTML = `
          <div class="peak-popover-title">${escapeHtml(peakName)}</div>
          <table class="peak-activity-table">
            <thead><tr><th>活动</th><th>开始</th><th>结束</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table>`;
      })
      .catch((err) => {
        if (activeBtn !== btn) return;
        popover.innerHTML = `<div class="peak-popover-title">${escapeHtml(peakName)}</div><div class="peak-popover-empty">${escapeHtml(errorMessage(err))}</div>`;
      });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePopover();
  });
}

function positionPopover(popover: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const scrollY = window.scrollY;
  popover.style.top = `${rect.bottom + scrollY + 6}px`;
  popover.style.left = `${Math.max(8, rect.left)}px`;
}

function leaderboardSvg(rows: LeaderboardRow[]): string {
  const width = 1240;
  const marginLeft = 230;
  const marginRight = 90;
  const barWidth = width - marginLeft - marginRight;
  const top = 150;
  const rowHeight = 30;
  const height = top + rows.length * rowHeight + 70;
  const unit = barWidth / Math.max(PEAKS.length, 1);

  const legendSpacing = Math.floor(barWidth / 8);
  const legend =
    `<g>${starSvg(marginLeft + 6, 97)}<text x="${marginLeft + 18}" y="103">东灵完成</text></g>` +
    BRANCHES.map((branch, index) => {
      const x = marginLeft + (index + 1) * legendSpacing;
      return `<g><rect x="${x}" y="92" width="12" height="12" fill="${branchColors[index]}"/><text x="${x + 18}" y="103">${escapeHtml(branch.name)}</text></g>`;
    }).join("") +
    `<g>${checkSvg(marginLeft + 7 * legendSpacing + 6, 97)}<text x="${marginLeft + 7 * legendSpacing + 18}" y="103">支线完成</text></g>`;

  const axis = Array.from({ length: Math.floor(PEAKS.length / 5) + 1 }, (_, index) => index * 5)
    .filter((value) => value <= PEAKS.length)
    .map((value) => {
      const x = marginLeft + value * unit;
      return `<g><line x1="${x}" y1="${top - 18}" x2="${x}" y2="${height - 44}" stroke="#d8d0c5" stroke-dasharray="2 4"/><text x="${x}" y="${top - 26}" text-anchor="middle">${value}</text></g>`;
    }).join("");

  const records = rows.map((row, rowIndex) => {
    const y = top + rowIndex * rowHeight;
    const counts = branchCounts(row.mask);
    const completeAll = isAllComplete(counts);
    const bars = completeAll ? completeGradientBarSvg(y, marginLeft, barWidth) : progressBarsSvg(counts, y, marginLeft, unit);
    const markers = completeAll ? completeMarkers(y, marginLeft, unit) : progressMarkers(row.mask, counts, y, marginLeft, unit);
    return `
      <g>
        <text x="${marginLeft - 18}" y="${y + 14}" class="name" text-anchor="end">${escapeHtml(row.name)}</text>
        <line x1="${marginLeft}" y1="${y + 9}" x2="${marginLeft + barWidth}" y2="${y + 9}" stroke="#eee8dd"/>
        ${bars}
        ${markers}
        <text x="${marginLeft + row.total_count * unit + 10}" y="${y + 14}" class="count">${row.total_count}</text>
      </g>
    `;
  }).join("");

  return `
    <svg id="leaderboard-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="complete-gradient" x1="${marginLeft}" y1="0" x2="${marginLeft + barWidth}" y2="0" gradientUnits="userSpaceOnUse">
          ${completeGradientStops()}
        </linearGradient>
      </defs>
      <style>
        text { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #2f2a24; }
        .title { font-size: 34px; font-weight: 750; }
        .caption, .count { font-size: 14px; fill: #786f64; }
        .name { font-size: 16px; }
        .count { font-weight: 700; fill: #2f2a24; }
      </style>
      <rect width="100%" height="100%" fill="#fbf8f1"/>
      <text x="${width / 2}" y="48" class="title" text-anchor="middle">京畿十峰挑战赛排行榜</text>
      <text x="${width / 2}" y="78" class="caption" text-anchor="middle">${escapeHtml(formatUpdatedAt(new Date()))}</text>
      ${legend}
      ${axis}
      ${records}
    </svg>
  `;
}

function completeGradientStops(): string {
  const stops: string[] = [`<stop offset="0%" stop-color="${branchColors[0]}"/>`];
  let offset = 0;

  BRANCHES.forEach((branch, index) => {
    const center = ((offset + branch.peaks.length / 2) / PEAKS.length) * 100;
    stops.push(`<stop offset="${formatSvgNumber(center)}%" stop-color="${branchColors[index]}"/>`);
    offset += branch.peaks.length;
  });

  stops.push(`<stop offset="100%" stop-color="${branchColors[branchColors.length - 1]}"/>`);
  return stops.join("");
}

function isAllComplete(counts: number[]): boolean {
  return BRANCHES.every((branch, index) => counts[index] === branch.peaks.length);
}

function completeGradientBarSvg(y: number, marginLeft: number, barWidth: number): string {
  return roundedEndBarSvg(marginLeft, y, barWidth, 18, "url(#complete-gradient)");
}

function completeMarkers(y: number, marginLeft: number, unit: number): string {
  const centerY = y + 9;
  return [
    starSvg(marginLeft + unit / 2, centerY),
    checkSvg(marginLeft + (PEAKS.length - 0.5) * unit, centerY),
  ].join("");
}

function progressBarsSvg(counts: number[], y: number, marginLeft: number, unit: number): string {
  const height = 18;
  const overlap = height / 2;
  const segments: Array<{ branchIndex: number; x: number; width: number }> = [];
  let progressOffset = 0;

  for (let branchIndex = 0; branchIndex < counts.length; branchIndex++) {
    const count = counts[branchIndex] ?? 0;
    if (count > 0) {
      const baseWidth = count * unit;
      const leftOverlap = segments.length === 0 ? 0 : overlap;
      segments.push({
        branchIndex,
        x: marginLeft + progressOffset * unit - leftOverlap,
        width: baseWidth + leftOverlap,
      });
    }
    progressOffset += count;
  }

  return segments
    .reverse()
    .map((segment) => roundedEndBarSvg(segment.x, y, segment.width, height, branchColors[segment.branchIndex]))
    .join("");
}

function roundedEndBarSvg(x: number, y: number, width: number, height: number, fill: string): string {
  const radius = Math.min(height / 2, width);
  return `<path d="M ${formatSvgNumber(x)} ${formatSvgNumber(y)} H ${formatSvgNumber(x + width - radius)} A ${formatSvgNumber(radius)} ${formatSvgNumber(radius)} 0 0 1 ${formatSvgNumber(x + width - radius)} ${formatSvgNumber(y + height)} H ${formatSvgNumber(x)} Z" fill="${fill}"/>`;
}

function progressMarkers(mask: number, counts: number[], y: number, marginLeft: number, unit: number): string {
  const centerY = y + 9;
  const markers: string[] = [];

  if (hasPeak(mask, 0)) {
    markers.push(starSvg(marginLeft + unit / 2, centerY));
  }

  let peakOffset = 0;
  let progressOffset = 0;
  for (let branchIndex = 0; branchIndex < BRANCHES.length; branchIndex++) {
    const branch = BRANCHES[branchIndex];
    const count = counts[branchIndex] ?? 0;
    if (branch.peaks.every((_peak, index) => hasPeak(mask, peakOffset + index))) {
      markers.push(checkSvg(marginLeft + (progressOffset + count - 0.5) * unit, centerY));
    }
    peakOffset += branch.peaks.length;
    progressOffset += count;
  }

  return markers.join("");
}

function starSvg(cx: number, cy: number): string {
  return `<path d="${starPath(cx, cy, 7, 3.1)}" fill="#bf4648"/>`;
}

function starPath(cx: number, cy: number, outerRadius: number, innerRadius: number): string {
  const points = Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5;
    const radius = index % 2 === 0 ? outerRadius : innerRadius;
    return `${formatSvgNumber(cx + Math.cos(angle) * radius)},${formatSvgNumber(cy + Math.sin(angle) * radius)}`;
  });
  return `M ${points.join(" L ")} Z`;
}

function checkSvg(cx: number, cy: number): string {
  return `
    <path d="M ${formatSvgNumber(cx - 6)} ${formatSvgNumber(cy - 1)} L ${formatSvgNumber(cx - 2)} ${formatSvgNumber(cy + 4)} L ${formatSvgNumber(cx + 7)} ${formatSvgNumber(cy - 6)}" fill="none" stroke="#111" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>
  `;
}

function formatSvgNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

async function renderAdmin(): Promise<void> {
  app.innerHTML = `
    <main class="shell admin-shell">
      <header class="hero compact">
        <div>
          <p class="eyebrow">管理后台</p>
          <h1>数据源管理</h1>
        </div>
        <a class="text-link" href="/">查看公开榜单</a>
      </header>
      <section id="admin-content" class="panel muted-panel">正在检查登录状态...</section>
    </main>
  `;

  try {
    const session = await api<{ authenticated: boolean }>("/api/admin/session");
    if (session.authenticated) {
      await renderAdminDashboard();
    } else {
      renderLogin();
    }
  } catch (error) {
    setAdminContent(`<div class="empty-state"><h2>无法连接后台</h2><p>${escapeHtml(errorMessage(error))}</p></div>`);
  }
}

function renderLogin(): void {
  setAdminContent(`
    <form id="login-form" class="login-form">
      <label>管理员 Token<input name="token" type="password" autocomplete="current-password" required /></label>
      <button class="button" type="submit">登录</button>
      <p id="login-message" class="message"></p>
    </form>
  `);

  document.getElementById("login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const message = document.getElementById("login-message")!;
    message.textContent = "正在登录...";
    try {
      await api("/api/admin/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: new FormData(form).get("token") }),
      });
      await renderAdminDashboard();
    } catch (error) {
      message.textContent = errorMessage(error);
    }
  });
}

async function renderAdminDashboard(): Promise<void> {
  const files = await api<FileList>("/api/admin/files");
  setAdminContent(`
    <div class="admin-grid">
      <section class="panel inner-panel">
        <h2>上传十峰挑战赛报名表</h2>
        <p>替换后会重建报名表和最终排行。</p>
        <form id="attendance-form" class="upload-form"><input name="file" type="file" accept=".xlsx" required /><button class="button" type="submit">上传报名表</button></form>
      </section>
      <section class="panel inner-panel">
        <h2>上传活动参与表</h2>
        <p>支持一次选择多个文件；同名文件会覆盖原数据源。</p>
        <form id="activity-form" class="upload-form"><input name="file" type="file" accept=".xlsx" multiple required /><button class="button" type="submit">上传活动表</button></form>
      </section>
    </div>
    <div class="toolbar admin-toolbar">
      <div class="admin-status">
        <p id="admin-message" class="message"></p>
        <div id="upload-progress" class="upload-progress" hidden aria-hidden="true">
          <div class="upload-progress-head"><span id="upload-progress-label">等待上传</span><span id="upload-progress-percent">0%</span></div>
          <div class="upload-progress-track"><div id="upload-progress-bar" class="upload-progress-bar"></div></div>
        </div>
      </div>
      <div class="actions"><button id="rebuild" class="button ghost" type="button">重建缓存</button><button id="logout" class="button ghost" type="button">退出登录</button></div>
    </div>
    ${fileListHtml(files)}
  `);

  bindUpload("attendance-form", "/api/admin/upload/attendance");
  bindUpload("activity-form", "/api/admin/upload/activity");
  bindAdminActions();
}

function fileListHtml(files: FileList): string {
  const attendance = files.attendance
    ? fileRow("attendance", "十峰挑战赛报名时间表", files.attendance.size, files.attendance.uploaded)
    : `<tr><td>十峰挑战赛报名时间表</td><td colspan="3"><span class="subtle">尚未上传</span></td></tr>`;
  const activities = files.activities.length
    ? files.activities.map((file) => fileRow("activity", file.name, file.size, file.uploaded)).join("")
    : `<tr><td colspan="4"><span class="subtle">尚无活动参与表</span></td></tr>`;

  return `
    <section class="panel">
      <h2>现有数据源</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>文件</th><th>大小</th><th>上传时间</th><th>操作</th></tr></thead>
          <tbody>${attendance}${activities}</tbody>
        </table>
      </div>
    </section>
  `;
}

function fileRow(type: "attendance" | "activity", name: string, size: number, uploaded: string | null): string {
  const query = new URLSearchParams({ type });
  if (type === "activity") query.set("name", name);
  return `
    <tr>
      <td>${escapeHtml(name)}</td>
      <td>${formatBytes(size)}</td>
      <td>${uploaded ? new Date(uploaded).toLocaleString("zh-CN") : "-"}</td>
      <td class="row-actions">
        <a class="text-link" href="/api/admin/download?${query.toString()}">下载</a>
        <button class="link-button danger" data-delete-type="${type}" data-delete-name="${escapeHtml(name)}" type="button">删除</button>
      </td>
    </tr>
  `;
}

function bindUpload(formId: string, url: string): void {
  document.getElementById(formId)?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const message = document.getElementById("admin-message")!;
    const progress = uploadProgressElements();
    const files = selectedFiles(form);
    setUploadBusy(form, true);
    message.textContent = uploadMessage(files);
    updateUploadProgress(progress, "正在上传文件...", 0);
    try {
      const result = await uploadWithProgress<UploadResult>(url, new FormData(form), {
        onUploadProgress: (percent) => updateUploadProgress(progress, uploadProgressLabel(files, percent), percent),
        onProcessing: () => updateUploadProgress(progress, "上传完成，正在解析并更新数据库...", 100, true),
      });
      message.textContent = formatUploadResult(result);
      await renderAdminDashboard();
    } catch (error) {
      message.textContent = errorMessage(error);
      updateUploadProgress(progress, "上传失败", 100, false, true);
    } finally {
      setUploadBusy(form, false);
    }
  });
}

function uploadMessage(files: File[]): string {
  return files.length > 1 ? `正在上传并处理 ${files.length} 个文件...` : "正在上传并处理...";
}

function uploadProgressLabel(files: File[], percent: number): string {
  const count = files.length > 1 ? `${files.length} 个文件` : files[0]?.name || "文件";
  return `正在上传 ${count}... ${percent}%`;
}

function formatUploadResult(result: UploadResult): string {
  if (result.count && result.count > 1) {
    return `处理完成：${result.count} 个活动表，${result.rows ?? 0} 条记录。`;
  }
  return "处理完成。";
}

function selectedFiles(form: HTMLFormElement): File[] {
  return [...form.querySelectorAll<HTMLInputElement>('input[type="file"]')].flatMap((input) => [...(input.files ?? [])]);
}

function setUploadBusy(form: HTMLFormElement, busy: boolean): void {
  form.querySelectorAll<HTMLButtonElement>('button[type="submit"]').forEach((button) => {
    button.disabled = busy;
  });
}

function uploadProgressElements(): UploadProgressElements {
  return {
    root: document.getElementById("upload-progress")!,
    bar: document.getElementById("upload-progress-bar")!,
    label: document.getElementById("upload-progress-label")!,
    percent: document.getElementById("upload-progress-percent")!,
  };
}

function updateUploadProgress(elements: UploadProgressElements, label: string, percent: number, processing = false, error = false): void {
  const value = clampProgress(percent);
  elements.root.hidden = false;
  elements.root.setAttribute("aria-hidden", "false");
  elements.root.classList.toggle("is-processing", processing);
  elements.root.classList.toggle("is-error", error);
  elements.label.textContent = label;
  elements.percent.textContent = processing ? "处理中" : `${value}%`;
  elements.bar.style.width = `${value}%`;
}

function clampProgress(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function uploadWithProgress<T>(url: string, body: FormData, callbacks: { onUploadProgress(percent: number): void; onProcessing(): void }): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.withCredentials = true;

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) {
        callbacks.onUploadProgress((event.loaded / event.total) * 100);
      }
    };

    xhr.upload.onload = () => callbacks.onProcessing();
    xhr.onerror = () => reject(new Error("网络错误，上传失败"));
    xhr.onabort = () => reject(new Error("上传已取消"));
    xhr.onload = () => {
      const body = parseXhrBody(xhr);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
        return;
      }

      reject(new Error(typeof body === "object" && body && "error" in body ? String(body.error) : String(body)));
    };

    xhr.send(body);
  });
}

function parseXhrBody(xhr: XMLHttpRequest): unknown {
  const contentType = xhr.getResponseHeader("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(xhr.responseText) as unknown;
    } catch {
      return xhr.responseText;
    }
  }
  return xhr.responseText;
}

function bindAdminActions(): void {
  document.getElementById("logout")?.addEventListener("click", async () => {
    await api("/api/admin/logout", { method: "POST" });
    renderLogin();
  });

  document.getElementById("rebuild")?.addEventListener("click", async () => {
    const message = document.getElementById("admin-message")!;
    message.textContent = "正在重建缓存...";
    try {
      await api("/api/admin/rebuild", { method: "POST" });
      message.textContent = "缓存已重建。";
    } catch (error) {
      message.textContent = errorMessage(error);
    }
  });

  document.querySelectorAll<HTMLButtonElement>("[data-delete-type]").forEach((button) => {
    button.addEventListener("click", async () => {
      const type = button.dataset.deleteType!;
      const name = button.dataset.deleteName ?? "";
      if (!confirm(`确定删除 ${name || "报名表"} 吗？`)) return;
      const query = new URLSearchParams({ type });
      if (type === "activity") query.set("name", name);
      const message = document.getElementById("admin-message")!;
      message.textContent = "正在删除...";
      try {
        await api(`/api/admin/files?${query.toString()}`, { method: "DELETE" });
        await renderAdminDashboard();
      } catch (error) {
        message.textContent = errorMessage(error);
      }
    });
  });
}

async function api<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", ...init });
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    throw new Error(typeof body === "object" && body && "error" in body ? String(body.error) : String(body));
  }
  return body as T;
}

function setPublicContent(html: string): void {
  document.getElementById("public-content")!.innerHTML = html;
}

function setAdminContent(html: string): void {
  document.getElementById("admin-content")!.innerHTML = html;
}

function downloadPng(): void {
  const svg = document.getElementById("leaderboard-svg");
  if (!(svg instanceof SVGSVGElement)) return;

  const { width, height } = svgSize(svg);
  const blob = new Blob([serializeSvg(svg)], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const scale = Math.max(1, window.devicePixelRatio || 1);
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * scale);
    canvas.height = Math.ceil(height * scale);
    const context = canvas.getContext("2d");
    URL.revokeObjectURL(url);
    if (!context) return;

    context.fillStyle = "#fbf8f1";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.scale(scale, scale);
    context.drawImage(image, 0, 0, width, height);
    canvas.toBlob((png) => {
      if (png) downloadBlob(png, leaderboardDownloadName("png"));
    }, "image/png");
  };

  image.onerror = () => URL.revokeObjectURL(url);
  image.src = url;
}

function serializeSvg(svg: Element): string {
  return new XMLSerializer().serializeToString(svg);
}

function svgSize(svg: SVGSVGElement): { width: number; height: number } {
  const viewBox = svg.viewBox.baseVal;
  return {
    width: svg.width.baseVal.value || viewBox.width,
    height: svg.height.baseVal.value || viewBox.height,
  };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function leaderboardDownloadName(extension: "png"): string {
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    "-",
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join("");
  return `京畿十峰排行榜_${timestamp}.${extension}`;
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

function formatUpdatedAt(date: Date): string {
  const month = pad2(date.getMonth() + 1);
  const day = pad2(date.getDate());
  const hours = pad2(date.getHours());
  const minutes = pad2(date.getMinutes());
  return `更新于${date.getFullYear()}年${month}月${day}日${hours}:${minutes}`;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
}

route();
