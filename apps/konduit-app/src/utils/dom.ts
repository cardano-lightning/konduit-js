import { parse, stringify, type Json } from "@konduit/codec/json";
import type { Result } from "neverthrow";
import { err } from "neverthrow";

export const loadJson = async (): Promise<Result<Json, string>> => {
  const promise: Promise<Result<Json, string>> = new Promise((resolve, reject) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json, .json";
    input.onchange = (event) => {
      if (
        event.target instanceof HTMLInputElement &&
        event.target.files &&
        event.target.files.length > 0
      ) {
      // Check if target and target files are defined and not empty
        const file = event.target.files[0];
        if (!file) {
          reject("No file selected");
        }
        const reader = new FileReader();
        reader.onload = (readerEvent: ProgressEvent<FileReader>) => {
          if (readerEvent.target?.result != null) {  // Use optional chaining and null check
            let content: ArrayBuffer | string = readerEvent.target.result;
            let fileContent: string;
            if (typeof content === 'string') {
              fileContent = content;
            } else {
              fileContent = new TextDecoder().decode(content);  // TS now knows content is ArrayBuffer
            }
            try {
              resolve(parse(fileContent));
            } catch (error) {
              reject(error);
            }
          }
        };
        reader.onerror = (error) => {
          reject(error);
        };
        if (file) reader.readAsText(file);
      } else {
        reject(new Error("No file selected"));
      }
    };
    input.click();
  });
  return promise
    .catch(async (e) => {
      return err(`Failed to read JSON file: ${e}`) as Result<Json, string>;
    });
}

export function writeJson(data: Json, filename = "data.json") {
  const jsonString = stringify(data);
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
