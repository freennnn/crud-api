export interface User {
  id: string;
  username: string;
  age: number;
  hobbies: string[];
}

export interface UserInput {
  username: string;
  age: number;
  hobbies: string[];
}

export interface ErrorResponse {
  message: string;
  statusCode: number;
}
