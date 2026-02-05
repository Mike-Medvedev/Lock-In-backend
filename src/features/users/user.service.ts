import { eq } from "drizzle-orm";
import { db, type DB } from "../../infra/db/db.ts";
import { users } from "../../infra/db/schema.ts";
import {
  CreateUserModel,
  SelectUserModel,
  type CreateUser,
  type SelectUser,
} from "./user.model.ts";

class UserService {
  constructor(private readonly _db: DB) {}

  async createUser(data: CreateUser): Promise<CreateUser> {
    const [newUser] = await this._db.insert(users).values(data).returning({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      email: users.email,
    });
    return CreateUserModel.parse(newUser);
  }

  async selectUser(userId: string): Promise<SelectUser | undefined> {
    const [user] = await this._db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId));
    return user ? SelectUserModel.parse(user) : undefined;
  }
}

export const userService = new UserService(db);
