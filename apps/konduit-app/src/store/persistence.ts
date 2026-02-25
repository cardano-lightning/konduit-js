import type { Json } from "@konduit/codec/json";
import { openDB, type IDBPDatabase } from "idb";
import type { Ref } from "vue";

const DB_NAME = "db";
const STORE_NAME = "kv";
const DB_VERSION = 1;

export async function get(key: string): Promise<Json> {
  return (await getDb()).get(STORE_NAME, key);
}

/**
 * Retrieves a value from the database store by its key.
 * @param {string} key - The key of the item to retrieve.
 * @returns {Promise<any>} A promise that resolves with the stored value, or undefined if not found.
 */
export async function set(key: string, val: any): Promise<IDBValidKey> {
  return (await getDb()).put(STORE_NAME, val, key);
}

/**
 * Deletes a value from the database store by its key.
 * @param {string} key - The key of the item to delete.
 * @returns {Promise<void>} A promise that resolves when the item is deleted.
 */
export async function del(key: string): Promise<void> {
  return (await getDb()).delete(STORE_NAME, key);
}

/**
 * Clears all items from the database store.
 * @returns {Promise<void>} A promise that resolves when the store is cleared.
 */
export async function clearDb(): Promise<void> {
  return (await getDb()).clear(STORE_NAME);
}

/**
 * Loads a value from the database and sets it to a Vue ref.
 * If the value is undefined in the DB, the ref is not modified.
 */
export async function fromDb(label: string): Promise<Json | null> {
  return get(label) || null;
}

/**
 * Loads a value from the database and sets it to a Vue ref.
 * If the value is undefined in the DB, the ref is not modified.
 * @param {string} label - The key to retrieve from the database.
 * @param {import('vue').Ref<any>} ref - The Vue ref to update with the loaded value.
 * @param {function (any) : any} with_ - Deserializer. FIXME. : why is this this asymmetric to toDb
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function fromDbWith(label: string, ref: Ref<any>, with_: (x: any) => any): Promise<void> {
  return get(label).then((x) => {
    if (typeof x !== "undefined") {
      ref.value = with_(x);
    }
  });
}

/**
 * Persists a value to the database.
 * If the value is null or undefined, the key is deleted from the database.
 * @param {string} label - The key to set or delete in the database.
 * @param {any} value - The value to store.
 * @returns {Promise<void>} A promise that resolves when the operation is complete.
 */
export async function toDb(label: string, value: Json): Promise<void> {
  if (value != null) {
    set(label, value);
  } else {
    del(label);
  }
}

let db: IDBPDatabase | null = null;

async function getDb(): Promise<IDBPDatabase> {
  if (db) {
    return db;
  }
  let _db = await openDB(DB_NAME, DB_VERSION, {
    /**
     * Called when the database version changes or the DB is created.
     */
    upgrade(_db) {
      if (_db && !_db.objectStoreNames.contains(STORE_NAME)) {
        _db.createObjectStore(STORE_NAME);
      }
    },
    /**
     * Called when a newer version of the DB is trying to open, but this connection is still open.
     */
    blocking() {
      console.warn("Database is outdated. Closing connection...");
      _db.close();
    },
    /**
     * Called when this connection is blocked from opening by another open connection.
     */
    blocked() {
      console.error("Database connection is blocked. Please close other tabs.");
      // NOTE: alert() is generally discouraged in modern web apps, but we keep it as it was in the original code.
      alert(
        "Database connection is blocked. Please close all other tabs running this site and reload.",
      );
    },
  });
  db = _db;
  return db;
}
