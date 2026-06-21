import { api } from "./client";

export interface PrinterInfo {
  state: string;
  state_message: string;
  hostname: string;
  software_version: string;
  cpu_info: string;
  klipper_path: string;
  python_path: string;
  log_file: string;
  config_file: string;
}

export interface PrinterObjectsQuery {
  eventtime: number;
  status: Record<string, Record<string, unknown>>;
}

export interface FileInfo {
  path: string;
  modified: number;
  size: number;
  permissions: string;
}

export interface HistoryJob {
  job_id: string;
  filename: string;
  status: string;
  start_time: number;
  end_time: number;
  total_duration: number;
  print_duration: number;
  filament_used: number;
}

export interface HistoryList {
  count: number;
  jobs: HistoryJob[];
}

export async function getPrinterInfo(): Promise<PrinterInfo> {
  const data = await api.get<{ result: PrinterInfo }>("/printer/info");
  return data.result;
}

export async function queryPrinterObjects(
  objects: Record<string, string[] | null>,
): Promise<PrinterObjectsQuery> {
  const params = new URLSearchParams();
  for (const [key, fields] of Object.entries(objects)) {
    if (fields && fields.length > 0) {
      params.append(key, fields.join(","));
    } else {
      params.append(key, "");
    }
  }
  const data = await api.get<{ result: PrinterObjectsQuery }>(
    `/printer/objects/query?${params.toString()}`,
  );
  return data.result;
}

export async function emergencyStop(): Promise<string> {
  return api.post("/printer/emergency_stop");
}

export async function sendGcode(script: string): Promise<string> {
  return api.post("/printer/gcode/script", { script });
}

export async function getFileList(path = "gcodes"): Promise<FileInfo[]> {
  const data = await api.get<{ result: FileInfo[] }>(
    `/server/files/list?root=${path}`,
  );
  return data.result || [];
}

export async function deleteFile(filePath: string): Promise<string> {
  return api.delete(`/server/files/${encodeURIComponent(filePath)}`);
}

export async function startPrint(filename: string): Promise<string> {
  return api.post("/printer/print/start", { filename });
}

export async function pausePrint(): Promise<string> {
  return api.post("/printer/print/pause");
}

export async function resumePrint(): Promise<string> {
  return api.post("/printer/print/resume");
}

export async function cancelPrint(): Promise<string> {
  return api.post("/printer/print/cancel");
}

export async function getHistoryList(): Promise<HistoryList> {
  const data = await api.get<{ result: HistoryList }>("/server/history/list");
  return data.result;
}
