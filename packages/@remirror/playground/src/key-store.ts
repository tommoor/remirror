/**
 * @module
 *
 * This provides an async key value store which are used to persist data in the
 * playground.
 */

// import { Store, set as setItem, get as getItem } from 'idb-keyval';
import { DBSchema, openDB } from 'idb';
import { Shape } from 'remirror';

const DATABASE_NAME = 'remirror-playground-db';
const DATABASE_VERSION = 1;
const KEY_VALUE_STORE = 'key-value-store';

interface StoreData<Value = unknown> {
  /** The identifier for each value */
  key: string;

  /** The JSON stringified values. */
  value: Value;
}

export interface NamedStores {
  [KEY_VALUE_STORE]: Shape;
}

/**
 * The schema for the playground schema.
 */
type StoreSchema = DBSchema &
  {
    [Name in keyof NamedStores]: StoreData<NamedStores[Name]>;
  };

/**
 * Create a custom key value store for the remirror playground database.
 *
 * This is like creating a new table which will be used to store data.
 */
export class Store<Name extends keyof NamedStores> {
  private readonly db = openDB<StoreSchema>(DATABASE_NAME, DATABASE_VERSION, {
    upgrade: (db) => {
      db.createObjectStore(this.name);
    },
  });

  constructor(private readonly name: Name) {}

  /**
   * Get the value of the provided key.
   */
  async get(key: string): Promise<StoreSchema[Name]['value'] | undefined> {
    const db = await this.db;
    const value = await db.get(this.name, key);

    return value;
  }

  /**
   * Set the value of the provided key to the provide value.
   */
  async set(key: string, value: NamedStores[Name]): Promise<void> {
    const db = await this.db;
    await db.put(this.name, value, key);
  }

  /**
   * Remove the provided key.
   */
  async remove(key: string): Promise<void> {
    const db = await this.db;
    await db.delete(this.name, key);
  }

  /**
   * Clear all the keys from the store.
   */
  async clear(): Promise<void> {
    const db = await this.db;
    await db.clear(this.name);
  }

  /**
   * Get all the keys from the key value storage.
   */
  async keys(): Promise<string[]> {
    const db = await this.db;
    return db.getAllKeys(this.name);
  }
}
