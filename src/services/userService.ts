import { v4 as uuidv4 } from "uuid";
import { User, UserInput } from "../types/user.js";

class UserService {
  private users: Map<string, User>;
  private static instance: UserService;

  public constructor() {
    this.users = new Map();
  }

  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  getAllUsers(): User[] {
    return Array.from(this.users.values());
  }

  getUserById(id: string): User | undefined {
    return this.users.get(id);
  }

  createUser(userData: UserInput): User {
    const id = uuidv4();
    const newUser: User = {
      id,
      ...userData,
    };
    this.users.set(id, newUser);
    return newUser;
  }

  updateUser(id: string, userData: UserInput): User | undefined {
    if (!this.users.has(id)) {
      return undefined;
    }

    const updatedUser: User = {
      id,
      ...userData, // Complete replacement of user data for PUT
    };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  deleteUser(id: string): boolean {
    return this.users.delete(id);
  }

  // For testing purposes
  clear(): void {
    this.users.clear();
  }
}

// Export the class directly
export { UserService };
