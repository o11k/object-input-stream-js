import type { Serializable, Externalizable, ObjectInputStream } from ".";
import { InvalidObjectException } from './exceptions';

export namespace java {
    export namespace lang {
        export class Byte implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Short implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Integer implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Long implements Serializable {
            value: bigint = 0n;
            readResolve() { return this.value; }
        }
        export class Float implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Double implements Serializable {
            value: number = 0;
            readResolve() { return this.value; }
        }
        export class Character implements Serializable {
            value: string = '\0';
            readResolve() { return this.value; }
        }
        export class Boolean implements Serializable {
            value: boolean = false;
            readResolve() { return this.value; }
        }
    }

    export namespace util {
        export class ArrayList extends Array implements Serializable {
            readObject(ois: ObjectInputStream): void {
                // Read size from fields
                const size = ois.readFields().get("size");
                if (typeof size !== "number" || size < 0)
                    throw new InvalidObjectException("Invalid size: " + size)

                // Read and ignore capacity
                ois.readInt();

                // Read all items
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class LinkedList extends Array implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class ArrayDeque extends Array implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.push(ois.readObject());
            }
        }

        export class HashSet extends Set implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields(); // None
                ois.readInt();    // Capacity
                ois.readFloat();  // Load factor

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }

        export class LinkedHashSet extends HashSet {}

        export class TreeSet extends Set implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields();
                ois.readObject();  // Comparator

                const size = ois.readInt();
                for (let i=0; i<size; i++)
                    this.add(ois.readObject());
            }
        }

        export class HashMap extends Map implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields();
                ois.readInt();

                const size = ois.readInt();
                for (let i=0; i<size; i++) {
                    const key = ois.readObject();
                    const val = ois.readObject();
                    this.set(key, val);
                }
            }
        }

        export class LinkedHashMap extends HashMap {}

        export class TreeMap extends Map implements Serializable {
            readObject(ois: ObjectInputStream): void {
                ois.readFields();

                const size = ois.readInt();
                for (let i=0; i<size; i++) {
                    const key = ois.readObject();
                    const val = ois.readObject();
                    this.set(key, val);
                }
            }
        }
    }
}

export const builtinSerializables = new Map<string, new () => Serializable>([
    ["java.lang.Byte", java.lang.Byte],
    ["java.lang.Short", java.lang.Short],
    ["java.lang.Integer", java.lang.Integer],
    ["java.lang.Long", java.lang.Long],
    ["java.lang.Float", java.lang.Float],
    ["java.lang.Double", java.lang.Double],
    ["java.lang.Character", java.lang.Character],
    ["java.lang.Boolean", java.lang.Boolean],

    ["java.util.ArrayList", java.util.ArrayList],
    ["java.util.LinkedList", java.util.LinkedList],
    ["java.util.ArrayDeque", java.util.ArrayDeque],
    ["java.util.HashSet", java.util.HashSet],
    ["java.util.LinkedHashSet", java.util.LinkedHashSet],
    ["java.util.TreeSet", java.util.TreeSet],
    ["java.util.HashMap", java.util.HashMap],
    ["java.util.LinkedHashMap", java.util.LinkedHashMap],
    ["java.util.TreeMap", java.util.TreeMap],
]);

export const builtinExternalizables = new Map<string, new () => Externalizable>([]);
