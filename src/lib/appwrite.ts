import { Client, Account, Functions, TablesDB } from "appwrite";
import { config } from "./config";

const client = new Client()
  .setEndpoint(config.appwriteEndpoint)
  .setProject(config.appwriteProjectId);

export const account = new Account(client);
export const tablesDb = new TablesDB(client);
export const functions = new Functions(client);
export { client };
