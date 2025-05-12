import { ServerResponse } from "node:http";
import { ErrorResponse } from "../types/user.js";

export const sendResponse = (
  res: ServerResponse,
  statusCode: number,
  data: any
) => {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
};

export const sendError = (res: ServerResponse, error: ErrorResponse) => {
  res.writeHead(error.statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ message: error.message }));
};

export const isValidUUID = (uuid: string): boolean => {
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/i;
  return uuidRegex.test(uuid);
};

export const validateUserInput = (
  data: any
): { isValid: boolean; message?: string } => {
  if (!data || typeof data !== "object") {
    return { isValid: false, message: "Invalid request body" };
  }

  if (!data.username || typeof data.username !== "string") {
    return {
      isValid: false,
      message: "Username is required and must be a string",
    };
  }

  if (!data.age || typeof data.age !== "number" || data.age < 0) {
    return {
      isValid: false,
      message: "Age is required and must be a positive number",
    };
  }

  if (!Array.isArray(data.hobbies)) {
    return { isValid: false, message: "Hobbies must be an array" };
  }

  if (!data.hobbies.every((hobby: any) => typeof hobby === "string")) {
    return { isValid: false, message: "All hobbies must be strings" };
  }

  return { isValid: true };
};
