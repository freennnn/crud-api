import { v4 as uuidv4 } from "uuid";
import { User, UserInput } from "../types/user.js";

class UserService {
  private users: User[] = [];

  getAllUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  createUser(userData: UserInput): User {
    const newUser: User = {
      id: uuidv4(),
      ...userData,
    };
    this.users.push(newUser);
    return newUser;
  }

  updateUser(id: string, userData: UserInput): User | undefined {
    const userIndex = this.users.findIndex((user) => user.id === id);
    if (userIndex === -1) return undefined;

    const updatedUser: User = {
      id,
      ...userData,
    };
    this.users[userIndex] = updatedUser;
    return updatedUser;
  }

  deleteUser(id: string): boolean {
    const initialLength = this.users.length;
    this.users = this.users.filter((user) => user.id !== id);
    return initialLength !== this.users.length;
  }
}

export const userService = new UserService();
